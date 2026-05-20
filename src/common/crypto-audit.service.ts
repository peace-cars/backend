import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as crypto from 'crypto';

@Injectable()
export class CryptoAuditService {
  private readonly logger = new Logger(CryptoAuditService.name);
  private readonly genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Appends an immutable cryptographic log to the audit chain.
   */
  async logAction(action: string, payload: any, actorId?: string): Promise<any> {
    try {
      const client = this.supabaseService.getClient();

      // 1. Fetch the absolute latest log to chain onto
      const { data: latestLog, error: fetchErr } = await client
        .from('crypto_audit_logs')
        .select('hash')
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchErr) {
        this.logger.error(`Error querying latest audit log: ${fetchErr.message}`);
      }

      const prevHash = latestLog && latestLog.length > 0 ? latestLog[0].hash : this.genesisHash;
      const timestamp = new Date().toISOString();

      // 2. Cryptographic signature generation
      const serializedPayload = JSON.stringify(payload || {});
      const hashInput = `${prevHash}|${action}|${serializedPayload}|${actorId || ''}|${timestamp}`;
      const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

      // 3. Write to Database
      const { data, error: insertErr } = await client
        .from('crypto_audit_logs')
        .insert([{
          actor_id: actorId || null,
          action,
          payload: payload || {},
          prev_hash: prevHash,
          hash,
          created_at: timestamp
        }])
        .select()
        .single();

      if (insertErr) {
        throw new Error(`Failed to write cryptographic audit log: ${insertErr.message}`);
      }

      this.logger.log(`Immutable Audit Log recorded: [${action}] -> Hash: ${hash.substring(0, 10)}...`);
      return data;
    } catch (e) {
      this.logger.error(`Audit logging failed: ${e.message}`);
      return null;
    }
  }

  /**
   * Verifies the cryptographic chain integrity from the genesis record down to the present day.
   * Returns a validation report detailing success status and any tampered items.
   */
  async verifyChain(): Promise<{ valid: boolean; totalLogs: number; tamperedLogIds: string[] }> {
    try {
      const client = this.supabaseService.getClient();

      // Fetch all logs in chronological order
      const { data: logs, error } = await client
        .from('crypto_audit_logs')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Could not fetch logs for verification: ${error.message}`);
      }

      const tamperedLogIds: string[] = [];
      let expectedPrevHash = this.genesisHash;

      for (const log of logs || []) {
        // Validate preceding block alignment
        if (log.prev_hash !== expectedPrevHash) {
          this.logger.warn(`Chain broken at Log ID ${log.id}. Expected prev_hash: ${expectedPrevHash}, Got: ${log.prev_hash}`);
          tamperedLogIds.push(log.id);
        }

        // Recompute current signature
        const serializedPayload = JSON.stringify(log.payload);
        const hashInput = `${log.prev_hash}|${log.action}|${serializedPayload}|${log.actor_id || ''}|${new Date(log.created_at).toISOString()}`;
        const computedHash = crypto.createHash('sha256').update(hashInput).digest('hex');

        if (log.hash !== computedHash) {
          this.logger.warn(`Signature mismatch at Log ID ${log.id}. Stored: ${log.hash}, Recomputed: ${computedHash}`);
          if (!tamperedLogIds.includes(log.id)) {
            tamperedLogIds.push(log.id);
          }
        }

        expectedPrevHash = log.hash;
      }

      return {
        valid: tamperedLogIds.length === 0,
        totalLogs: logs?.length || 0,
        tamperedLogIds
      };
    } catch (e) {
      this.logger.error(`Audit chain verification aborted: ${e.message}`);
      return { valid: false, totalLogs: 0, tamperedLogIds: [] };
    }
  }
}
