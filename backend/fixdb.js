require('dotenv').config();
const pool = require('./db/pool');

pool.query(`
  DROP TABLE IF EXISTS cp_position_role_permissions CASCADE;
  CREATE TABLE cp_position_role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES cp_position_roles(id) ON DELETE CASCADE,
    perm_type VARCHAR(20) NOT NULL DEFAULT 'page',
    perm_key VARCHAR(200) NOT NULL,
    UNIQUE(role_id, perm_type, perm_key)
  );
`).then(() => { console.log('Done'); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });