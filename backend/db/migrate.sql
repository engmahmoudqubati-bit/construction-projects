-- Migration v2 — safe to run multiple times

-- Companies
CREATE TABLE IF NOT EXISTS cp_companies (
  id         SERIAL PRIMARY KEY,
  company_code VARCHAR(50) UNIQUE,
  name_ar    VARCHAR(200) NOT NULL,
  name_en    VARCHAR(200) NOT NULL,
  type       VARCHAR(20)  NOT NULL CHECK (type IN ('holding','organization')),
  tax_id     VARCHAR(100),
  parent_id  INTEGER REFERENCES cp_companies(id) ON DELETE SET NULL,
  is_active  BOOLEAN   DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Position roles
CREATE TABLE IF NOT EXISTS cp_position_roles (
  id         SERIAL PRIMARY KEY,
  name_ar    VARCHAR(200) NOT NULL,
  name_en    VARCHAR(200) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Permission categories: page_access, form_actions, project_access stored per role
CREATE TABLE IF NOT EXISTS cp_position_role_permissions (
  id         SERIAL PRIMARY KEY,
  role_id    INTEGER NOT NULL REFERENCES cp_position_roles(id) ON DELETE CASCADE,
  perm_type  VARCHAR(20) NOT NULL DEFAULT 'page', -- page | action | project
  perm_key   VARCHAR(200) NOT NULL,
  UNIQUE(role_id, perm_type, perm_key)
);

-- Add columns to cp_users
ALTER TABLE cp_users ADD COLUMN IF NOT EXISTS full_name_ar      VARCHAR(100);
ALTER TABLE cp_users ADD COLUMN IF NOT EXISTS full_name_en      VARCHAR(100);
ALTER TABLE cp_users ADD COLUMN IF NOT EXISTS photo_url         TEXT;
ALTER TABLE cp_users ADD COLUMN IF NOT EXISTS position_role_id  INTEGER REFERENCES cp_position_roles(id) ON DELETE SET NULL;
ALTER TABLE cp_users ADD COLUMN IF NOT EXISTS company_id        INTEGER REFERENCES cp_companies(id) ON DELETE SET NULL;

-- Add company_code to cp_companies if not exists
ALTER TABLE cp_companies ADD COLUMN IF NOT EXISTS company_code VARCHAR(50);

-- Add status to transactions for save/confirm workflow
ALTER TABLE cp_project_planning ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','prepared','confirmed'));

ALTER TABLE cp_delivery_transactions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','confirmed'));
ALTER TABLE cp_installation_transactions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','confirmed'));
ALTER TABLE cp_inspection_transactions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','confirmed'));

-- Auto-numbering sequences for codes
CREATE SEQUENCE IF NOT EXISTS cp_item_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS cp_project_code_seq START 1;
-- Add tx_status to transaction tables
ALTER TABLE cp_delivery_transactions     ADD COLUMN IF NOT EXISTS tx_status VARCHAR(20) DEFAULT 'draft' CHECK (tx_status IN ('draft','confirmed'));
ALTER TABLE cp_installation_transactions ADD COLUMN IF NOT EXISTS tx_status VARCHAR(20) DEFAULT 'draft' CHECK (tx_status IN ('draft','confirmed'));
ALTER TABLE cp_inspection_transactions   ADD COLUMN IF NOT EXISTS tx_status VARCHAR(20) DEFAULT 'draft' CHECK (tx_status IN ('draft','confirmed'));

-- Update api client confirm routes
-- delivery:     PATCH /api/delivery/confirm
-- installation: PATCH /api/installation/confirm
-- inspection:   PATCH /api/inspection/confirm
-- Add position_code and is_active to cp_position_roles
ALTER TABLE cp_position_roles ADD COLUMN IF NOT EXISTS position_code VARCHAR(50);
ALTER TABLE cp_position_roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add name_ar to item classifications
ALTER TABLE cp_item_classifications ADD COLUMN IF NOT EXISTS classification_name_ar VARCHAR(255);