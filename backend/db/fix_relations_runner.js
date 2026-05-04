require('dotenv').config();
const pool = require('./pool');
const fs   = require('fs');
const path = require('path');

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'fix_relations.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅ All foreign key relations fixed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error fixing relations:', err.message);
    process.exit(1);
  }
}

run();