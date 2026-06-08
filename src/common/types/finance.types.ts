export interface LedgerEntry {
  id: string;
  account_id: string;
  transaction_id: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  currency: string;
  balance_after: number;
}
