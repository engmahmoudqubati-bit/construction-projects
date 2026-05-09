const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:BzzannBjvorypPXDdgefokefEBYWrdvL@switchyard.proxy.rlwy.net:16106/railway',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Connected. Running migration...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS cp_project_levels (
        id           SERIAL PRIMARY KEY,
        project_id   INTEGER NOT NULL REFERENCES cp_projects(id) ON DELETE CASCADE,
        level_code   VARCHAR(20)  NOT NULL,
        level_name   VARCHAR(100) NOT NULL,
        sort_order   INTEGER DEFAULT 0,
        created_at   TIMESTAMP DEFAULT NOW(),
        UNIQUE(project_id, level_code)
      )
    `);
    console.log('✓ Created cp_project_levels');

    await client.query(`
      CREATE TABLE IF NOT EXISTS cp_installation_level_allocation (
        id            SERIAL PRIMARY KEY,
        project_id    INTEGER NOT NULL REFERENCES cp_projects(id) ON DELETE CASCADE,
        item_id       INTEGER NOT NULL REFERENCES cp_items(id)    ON DELETE CASCADE,
        level_id      INTEGER NOT NULL REFERENCES cp_project_levels(id) ON DELETE CASCADE,
        suggested_qty DECIMAL(12,2) NOT NULL DEFAULT 0,
        created_at    TIMESTAMP DEFAULT NOW(),
        UNIQUE(project_id, item_id, level_id)
      )
    `);
    console.log('✓ Created cp_installation_level_allocation');

    await client.query(`ALTER TABLE cp_installation_transactions ADD COLUMN IF NOT EXISTS level_id INTEGER REFERENCES cp_project_levels(id) ON DELETE SET NULL`);
    console.log('✓ Added level_id to cp_installation_transactions');

    await client.query(`ALTER TABLE cp_installation_transactions DROP CONSTRAINT IF EXISTS cp_installation_transactions_project_id_item_id_transaction_da_key`);
    await client.query(`ALTER TABLE cp_installation_transactions DROP CONSTRAINT IF EXISTS cp_installation_transactions_unique`);
    await client.query(`ALTER TABLE cp_installation_transactions ADD CONSTRAINT cp_installation_transactions_unique UNIQUE(project_id, item_id, level_id, transaction_date)`);
    console.log('✓ Updated unique constraint to include level_id');

    console.log('Done!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}
run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });