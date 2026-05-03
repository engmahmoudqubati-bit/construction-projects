// Run once: node db/seed.js
// Creates the default admin user (admin / Admin@1234)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('./pool');
const bcrypt = require('bcryptjs');

async function seed() {
  const hash = await bcrypt.hash('Admin@1234', 10);
  await pool.query(
    `INSERT INTO cp_users (full_name, username, password, role, email, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (username) DO NOTHING`,
    ['System Administrator', 'admin', hash, 'admin', 'admin@construction.com', true]
  );
  console.log('Seed complete — admin / Admin@1234');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
