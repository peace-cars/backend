const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY); // Using service_role key to bypass direct RLS for admin verification

async function verifyLedgerAndCrypto() {
  console.log("==========================================================================");
  console.log("PeaceCars ERP Hardening: Automated Verification for Ledger & Crypto Chain");
  console.log("==========================================================================\n");

  try {
    // 1. Fetch Accounts to make sure standard charts of accounts exist
    console.log("Step 1: Checking chart of accounts...");
    const { data: accounts, error: accError } = await supabase
      .from('accounts')
      .select('*')
      .order('name');

    if (accError) {
      console.error("❌ Failed to fetch accounts. Have you applied the migrations?", accError.message);
      return;
    }

    console.log(`✅ Chart of accounts verified. Found ${accounts.length} accounts:`);
    accounts.forEach(acc => {
      console.log(`  - [${acc.type}] ${acc.name}: live balance = ETB ${Number(acc.balance).toFixed(2)}`);
    });
    console.log("");

    // 2. Simulate balanced Transaction (DEBITS = CREDITS)
    console.log("Step 2: Simulating manual ledger insertion for transaction verification...");
    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .insert([{
        description: 'Test Verification Transaction - Balanced Repair Expense',
        reference_type: 'TEST_VERIFICATION',
        reference_id: '00000000-0000-0000-0000-000000000000'
      }])
      .select()
      .single();

    if (txErr || !tx) {
      console.error("❌ Failed to create test transaction:", txErr?.message);
      return;
    }
    console.log(`✅ Transaction header created successfully (ID: ${tx.id}).`);

    // Let's find operational cash and repair expense IDs
    const cashAcc = accounts.find(a => a.name === 'Operational Cash');
    const repairAcc = accounts.find(a => a.name === 'Vehicle Repair Expense');

    if (!cashAcc || !repairAcc) {
      console.error("❌ Operational Cash or Vehicle Repair Expense accounts are missing!");
      return;
    }

    // Insert BALANCED entries
    console.log("Posting balanced ledger entries (Debit ETB 1000 to Repair, Credit ETB 1000 to Cash)...");
    const { data: entries, error: entryErr } = await supabase
      .from('ledger_entries')
      .insert([
        { transaction_id: tx.id, account_id: repairAcc.id, type: 'DEBIT', amount: 1000.00 },
        { transaction_id: tx.id, account_id: cashAcc.id, type: 'CREDIT', amount: 1000.00 }
      ])
      .select();

    if (entryErr) {
      console.error("❌ Failed to insert balanced ledger entries:", entryErr.message);
    } else {
      console.log(`✅ Balanced entries posted successfully. Modified account balances update live in the database.`);
    }

    // 3. Verify math parity check trigger by attempting to post an IMBALANCED transaction
    console.log("\nStep 3: Testing database parity constraint trigger (Debits must equal Credits)...");
    const { data: txBad, error: txBadErr } = await supabase
      .from('transactions')
      .insert([{
        description: 'Test Verification Transaction - Imbalanced Error Path',
        reference_type: 'TEST_VERIFICATION_FAIL',
        reference_id: '00000000-0000-0000-0000-000000000000'
      }])
      .select()
      .single();

    if (!txBadErr) {
      console.log("Header for imbalanced transaction created.");
      
      // Attempting to insert imbalanced entry (only Debit, no Credit)
      const { error: badEntryErr } = await supabase
        .from('ledger_entries')
        .insert([
          { transaction_id: txBad.id, account_id: repairAcc.id, type: 'DEBIT', amount: 5000.00 }
        ]);

      if (badEntryErr) {
        console.log(`✅ Double-entry constraint working! Blocked imbalanced entry. Error message: "${badEntryErr.message}"`);
      } else {
        console.warn("⚠️ Warning: Imbalanced entries were inserted. Ensure that the postgres constraint trigger is properly created and deferred.");
      }

      // Cleanup bad transaction header
      await supabase.from('transactions').delete().eq('id', txBad.id);
    }

    // 4. Verify Cryptographic log chain validation
    console.log("\nStep 4: Fetching cryptographic audit log chain and running validation report...");
    const { data: logs, error: logErr } = await supabase
      .from('crypto_audit_logs')
      .select('*')
      .order('created_at', { ascending: true });

    if (logErr) {
      console.error("❌ Failed to query crypto_audit_logs table:", logErr.message);
      return;
    }

    console.log(`Retrieved ${logs.length} cryptographic audit logs. Commencing validation sequence...`);

    const genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';
    let expectedPrevHash = genesisHash;
    let chainIntegrity = true;
    const tamperedLogs = [];

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      
      // 1. Verify link between logs
      if (log.prev_hash !== expectedPrevHash) {
        console.error(`  ❌ [LINK FAILURE] at Index ${i} (Log ID: ${log.id})!`);
        console.error(`     Expected prev_hash: ${expectedPrevHash}`);
        console.error(`     Got prev_hash:      ${log.prev_hash}`);
        chainIntegrity = false;
        tamperedLogs.push(log.id);
      }

      // 2. Recompute current SHA-256 signature
      const serializedPayload = JSON.stringify(log.payload);
      const hashInput = `${log.prev_hash}|${log.action}|${serializedPayload}|${log.actor_id || ''}|${new Date(log.created_at).toISOString()}`;
      const computedHash = crypto.createHash('sha256').update(hashInput).digest('hex');

      if (log.hash !== computedHash) {
        console.error(`  ❌ [SIGNATURE MATCH FAILURE] at Index ${i} (Log ID: ${log.id})!`);
        console.error(`     Stored hash:   ${log.hash}`);
        console.error(`     Recomputed:    ${computedHash}`);
        chainIntegrity = false;
        if (!tamperedLogs.includes(log.id)) {
          tamperedLogs.push(log.id);
        }
      } else {
        console.log(`  [Block #${i.toString().padStart(2, '0')}] Validated link & payload hash: ${log.hash.substring(0, 16)}...`);
      }

      expectedPrevHash = log.hash;
    }

    console.log("\n==========================================================================");
    if (chainIntegrity) {
      console.log("🏆 CRYPTOGRAPHIC AUDIT LOG INTEGRITY: SECURED & 100% UNTAMPERED");
      console.log("No alterations, deletions, or structural modifications were detected.");
    } else {
      console.error("🚨 CRYPTOGRAPHIC AUDIT LOG INTEGRITY: TAMPERED OR BROKEN!");
      console.error(`Found ${tamperedLogs.length} corrupted blocks.`);
    }
    console.log("==========================================================================\n");

    // Cleanup mock data
    console.log("Cleaning up mock transaction data...");
    await supabase.from('transactions').delete().eq('id', tx.id);
    console.log("Cleanup complete! Verification ended successfully.");

  } catch (err) {
    console.error("Verification execution crashed:", err.message);
  }
}

verifyLedgerAndCrypto();
