const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:BzzannBjvorypPXDdgefokefEBYWrdvL@switchyard.proxy.rlwy.net:16106/railway',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Connected. Running migration...');

    await client.query(`ALTER TABLE cp_delivery_transactions DROP CONSTRAINT IF EXISTS cp_delivery_transactions_tx_status_check`);
    console.log('✓ Dropped old constraint');

    // Migrate ALL non-standard values to 'incomplete' BEFORE adding constraint
    const r1 = await client.query(`UPDATE cp_delivery_transactions SET tx_status='incomplete' WHERE tx_status NOT IN ('incomplete','saved','confirmed')`);
    console.log(`✓ Migrated ${r1.rowCount} rows → incomplete`);

    // Check what values still exist
    const check = await client.query(`SELECT tx_status, COUNT(*) FROM cp_delivery_transactions GROUP BY tx_status`);
    console.log('Current tx_status values:', check.rows);

    await client.query(`ALTER TABLE cp_delivery_transactions ADD CONSTRAINT cp_delivery_transactions_tx_status_check CHECK (tx_status IN ('incomplete','saved','confirmed'))`);
    console.log('✓ Added new constraint');

    console.log('Done!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});