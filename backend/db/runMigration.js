const pool = require('./pool');
const fs   = require('fs');
const path = require('path');

async function runMigration() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'migrate.sql'), 'utf8');
    await pool.query(sql);
    console.log('Migration complete');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

module.exports = runMigration;