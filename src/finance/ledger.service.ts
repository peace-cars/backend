import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CryptoAuditService } from '../common/crypto-audit.service';

export interface LedgerEntryDto {
  accountName: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly cryptoAuditService: CryptoAuditService,
  ) {}

  /**
   * Posts a set of double-entry ledger entries for a single transaction.
   * Ensures mathematical balancing (Debits == Credits) and registers a cryptographic audit trail.
   */
  async postTransaction(
    description: string,
    refType: string,
    refId: string,
    entries: LedgerEntryDto[],
    actorId?: string
  ) {
    try {
      const client = this.supabaseService.getClient();

      // 1. Math balance validation
      const debits = entries
        .filter((e) => e.type === 'DEBIT')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const credits = entries
        .filter((e) => e.type === 'CREDIT')
        .reduce((sum, e) => sum + Number(e.amount), 0);

      // Tolerate minor floating point variance (less than 1 cent)
      if (Math.abs(debits - credits) >= 0.01) {
        throw new BadRequestException(
          `Imbalanced transaction: Debits (${debits.toFixed(2)}) must equal Credits (${credits.toFixed(2)})`
        );
      }

      // 2. Fetch corresponding account UUIDs by account names
      const accountNames = Array.from(new Set(entries.map((e) => e.accountName)));
      const { data: accounts, error: accError } = await client
        .from('accounts')
        .select('id, name')
        .in('name', accountNames);

      if (accError || !accounts || accounts.length < accountNames.length) {
        const found = accounts ? accounts.map((a) => a.name) : [];
        const missing = accountNames.filter((name) => !found.includes(name));
        throw new BadRequestException(
          `Ledger accounts not found: ${missing.join(', ')}. Please verify the chart of accounts.`
        );
      }

      const accountMap = new Map<string, string>(
        accounts.map((a) => [a.name, a.id])
      );

      // 3. Insert transaction header
      const { data: transaction, error: txError } = await client
        .from('transactions')
        .insert([{
          description,
          reference_type: refType,
          reference_id: refId
        }])
        .select()
        .single();

      if (txError || !transaction) {
        throw new Error(`Failed to create transaction header: ${txError?.message}`);
      }

      // 4. Insert ledger entries linked to the transaction header
      const preparedEntries = entries.map((e) => ({
        transaction_id: transaction.id,
        account_id: accountMap.get(e.accountName)!,
        type: e.type,
        amount: Number(e.amount)
      }));

      const { error: entriesError } = await client
        .from('ledger_entries')
        .insert(preparedEntries);

      if (entriesError) {
        // Because of the database CONSTRAINT trigger we added, this insert will fail 
        // if debits do not equal credits in the actual DB records.
        throw new Error(`Failed to insert ledger entries: ${entriesError.message}`);
      }

      this.logger.log(`Posted ledger transaction: "${description}" (ID: ${transaction.id}) for $${debits.toFixed(2)}`);

      // 5. Build and attach cryptographic audit record
      await this.cryptoAuditService.logAction('LEDGER_TRANSACTION_POSTED', {
        transactionId: transaction.id,
        description,
        referenceType: refType,
        referenceId: refId,
        entries: entries.map(e => ({ accountName: e.accountName, type: e.type, amount: e.amount }))
      }, actorId);

      return transaction;
    } catch (e) {
      this.logger.error(`Financial ledger transaction failed: ${e.message}`);
      throw e;
    }
  }

  /**
   * Retrieves all corporate accounts and their current balances.
   */
  async getAccounts() {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('accounts')
        .select('*')
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (e) {
      this.logger.error(`Failed to fetch ledger accounts: ${e.message}`);
      return [];
    }
  }

  /**
   * Retrieves chronological ledger entry history.
   */
  async getLedgerHistory(limit = 100) {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('ledger_entries')
        .select(`
          id,
          type,
          amount,
          created_at,
          accounts(name, type),
          transactions(description, reference_type, reference_id)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (e) {
      this.logger.error(`Failed to fetch ledger history: ${e.message}`);
      return [];
    }
  }
}
