// Run once: node db/migrate.js
// Adds status column to cp_project_planning and relaxes planned_qty constraint
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add status column if not exists
    await client.query(`
      ALTER TABLE cp_project_planning
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'
      CHECK (status IN ('draft','prepared','confirmed'))
    `);

    // Drop old planned_qty > 0 constraint and allow >= 0
    await client.query(`
      ALTER TABLE cp_project_planning
      DROP CONSTRAINT IF EXISTS cp_project_planning_planned_qty_check
    `);
    await client.query(`
      ALTER TABLE cp_project_planning
      ADD CONSTRAINT cp_project_planning_planned_qty_check CHECK (planned_qty >= 0)
    `);

    // Set default 0 for planned_qty
    await client.query(`
      ALTER TABLE cp_project_planning ALTER COLUMN planned_qty SET DEFAULT 0
    `);

    await client.query('COMMIT');
    console.log('Migration complete');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
