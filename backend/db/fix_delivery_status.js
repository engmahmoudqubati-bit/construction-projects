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

    await client.query(`ALTER TABLE cp_delivery_transactions ADD CONSTRAINT cp_delivery_transactions_tx_status_check CHECK (tx_status IN ('incomplete','saved','confirmed'))`);
    console.log('✓ Added new constraint');

    const r = await client.query(`UPDATE cp_delivery_transactions SET tx_status='incomplete' WHERE tx_status='draft'`);
    console.log(`✓ Migrated ${r.rowCount} draft rows → incomplete`);

    console.log('Done!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();