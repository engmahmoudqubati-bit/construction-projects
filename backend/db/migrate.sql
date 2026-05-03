-- Run this migration to add new tables and columns
-- Safe to run multiple times (uses IF NOT EXISTS and IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS cp_companies (
  id         SERIAL PRIMARY KEY,
  name_ar    VARCHAR(200) NOT NULL,
  name_en    VARCHAR(200) NOT NULL,
  type       VARCHAR(20)  NOT NULL CHECK (type IN ('holding','organization')),
  tax_id     VARCHAR(100),
  parent_id  INTEGER REFERENCES cp_companies(id) ON DELETE SET NULL,
  is_active  BOOLEAN   DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cp_position_roles (
  id         SERIAL PRIMARY KEY,
  name_ar    VARCHAR(200) NOT NULL,
  name_en    VARCHAR(200) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cp_position_role_permissions (
  id       SERIAL PRIMARY KEY,
  role_id  INTEGER NOT NULL REFERENCES cp_position_roles(id) ON DELETE CASCADE,
  page_key VARCHAR(100) NOT NULL,
  UNIQUE(role_id, page_key)
);

ALTER TABLE cp_users ADD COLUMN IF NOT EXISTS full_name_ar      VARCHAR(100);
ALTER TABLE cp_users ADD COLUMN IF NOT EXISTS full_name_en      VARCHAR(100);
ALTER TABLE cp_users ADD COLUMN IF NOT EXISTS photo_url         TEXT;
ALTER TABLE cp_users ADD COLUMN IF NOT EXISTS position_role_id  INTEGER REFERENCES cp_position_roles(id) ON DELETE SET NULL;
ALTER TABLE cp_users ADD COLUMN IF NOT EXISTS company_id        INTEGER REFERENCES cp_companies(id) ON DELETE SET NULL;