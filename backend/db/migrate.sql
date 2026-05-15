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

-- Measurements table
CREATE TABLE IF NOT EXISTS cp_measurements (
  id          SERIAL PRIMARY KEY,
  unit_code   VARCHAR(50) UNIQUE NOT NULL,
  desc_en     VARCHAR(200) NOT NULL,
  desc_ar     VARCHAR(200),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Add measurement_id to cp_items
ALTER TABLE cp_items ADD COLUMN IF NOT EXISTS measurement_id INTEGER REFERENCES cp_measurements(id) ON DELETE RESTRICT;
-- Keep unit_of_measure for backward compat

-- Add missing columns to cp_items
ALTER TABLE cp_items ADD COLUMN IF NOT EXISTS item_name_ar VARCHAR(255);
ALTER TABLE cp_items ADD COLUMN IF NOT EXISTS measurement_id INTEGER REFERENCES cp_measurements(id) ON DELETE RESTRICT;

-- Update BOQ status column
ALTER TABLE cp_project_planning DROP CONSTRAINT IF EXISTS cp_project_planning_status_check;
ALTER TABLE cp_project_planning ADD CONSTRAINT cp_project_planning_status_check
  CHECK (status IN ('draft','prepared','confirmed','incomplete','saved','approved'));
-- Expand delivery/installation/inspection tx_status to support incomplete, saved, confirmed
ALTER TABLE cp_delivery_transactions DROP CONSTRAINT IF EXISTS cp_delivery_transactions_tx_status_check;
ALTER TABLE cp_delivery_transactions ADD CONSTRAINT cp_delivery_transactions_tx_status_check
  CHECK (tx_status IN ('incomplete','saved','confirmed'));
-- Migrate existing 'draft' rows to 'incomplete'
UPDATE cp_delivery_transactions SET tx_status='incomplete' WHERE tx_status='draft';

ALTER TABLE cp_installation_transactions DROP CONSTRAINT IF EXISTS cp_installation_transactions_tx_status_check;
ALTER TABLE cp_installation_transactions ADD CONSTRAINT cp_installation_transactions_tx_status_check
  CHECK (tx_status IN ('incomplete','saved','confirmed'));
UPDATE cp_installation_transactions SET tx_status='incomplete' WHERE tx_status='draft';

ALTER TABLE cp_inspection_transactions DROP CONSTRAINT IF EXISTS cp_inspection_transactions_tx_status_check;
ALTER TABLE cp_inspection_transactions ADD CONSTRAINT cp_inspection_transactions_tx_status_check
  CHECK (tx_status IN ('incomplete','saved','confirmed'));
UPDATE cp_inspection_transactions SET tx_status='incomplete' WHERE tx_status='draft';




-- Optional audit setup for full future action history in Entry Logs.
-- Run once in PostgreSQL if you want exact created/updated/deleted action records going forward.
-- Existing old transactions can only show current status because old action history was not stored.

CREATE TABLE IF NOT EXISTS cp_entry_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  process VARCHAR(30) NOT NULL,
  action VARCHAR(80) NOT NULL,
  project_id INTEGER REFERENCES cp_projects(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES cp_items(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES cp_users(id) ON DELETE SET NULL,
  transaction_date DATE,
  qty NUMERIC(14,3),
  status_from VARCHAR(30),
  status_to VARCHAR(30),
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION cp_log_delivery_audit() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO cp_entry_audit_logs(process, action, project_id, item_id, user_id, transaction_date, qty, status_to, details)
    VALUES ('delivery', CASE WHEN NEW.tx_status='confirmed' THEN 'Confirm Delivery' WHEN NEW.tx_status='saved' THEN 'Save Delivery' ELSE 'Entry Delivery' END,
            NEW.project_id, NEW.item_id, NEW.engineer_id, NEW.transaction_date, NEW.qty_delivered, NEW.tx_status, NEW.notes);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO cp_entry_audit_logs(process, action, project_id, item_id, user_id, transaction_date, qty, status_from, status_to, details)
    VALUES ('delivery', CASE WHEN OLD.tx_status <> NEW.tx_status AND NEW.tx_status='confirmed' THEN 'Confirm Delivery'
                             WHEN OLD.tx_status <> NEW.tx_status AND NEW.tx_status='saved' THEN 'Save Delivery'
                             ELSE 'Update Delivery' END,
            NEW.project_id, NEW.item_id, NEW.engineer_id, NEW.transaction_date, NEW.qty_delivered, OLD.tx_status, NEW.tx_status, NEW.notes);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO cp_entry_audit_logs(process, action, project_id, item_id, user_id, transaction_date, qty, status_from, details)
    VALUES ('delivery', 'Delete Delivery', OLD.project_id, OLD.item_id, OLD.engineer_id, OLD.transaction_date, OLD.qty_delivered, OLD.tx_status, OLD.notes);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cp_delivery_audit ON cp_delivery_transactions;
CREATE TRIGGER trg_cp_delivery_audit AFTER INSERT OR UPDATE OR DELETE ON cp_delivery_transactions
FOR EACH ROW EXECUTE FUNCTION cp_log_delivery_audit();

CREATE OR REPLACE FUNCTION cp_log_installation_audit() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO cp_entry_audit_logs(process, action, project_id, item_id, user_id, transaction_date, qty, status_to, details)
    VALUES ('installation', CASE WHEN NEW.tx_status='confirmed' THEN 'Confirm Installation' WHEN NEW.tx_status='saved' THEN 'Save Installation' ELSE 'Entry Installation' END,
            NEW.project_id, NEW.item_id, NEW.engineer_id, NEW.transaction_date, NEW.qty_installed, NEW.tx_status, NEW.notes);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO cp_entry_audit_logs(process, action, project_id, item_id, user_id, transaction_date, qty, status_from, status_to, details)
    VALUES ('installation', CASE WHEN OLD.tx_status <> NEW.tx_status AND NEW.tx_status='confirmed' THEN 'Confirm Installation'
                                 WHEN OLD.tx_status <> NEW.tx_status AND NEW.tx_status='saved' THEN 'Save Installation'
                                 ELSE 'Update Installation' END,
            NEW.project_id, NEW.item_id, NEW.engineer_id, NEW.transaction_date, NEW.qty_installed, OLD.tx_status, NEW.tx_status, NEW.notes);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO cp_entry_audit_logs(process, action, project_id, item_id, user_id, transaction_date, qty, status_from, details)
    VALUES ('installation', 'Delete Installation', OLD.project_id, OLD.item_id, OLD.engineer_id, OLD.transaction_date, OLD.qty_installed, OLD.tx_status, OLD.notes);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cp_installation_audit ON cp_installation_transactions;
CREATE TRIGGER trg_cp_installation_audit AFTER INSERT OR UPDATE OR DELETE ON cp_installation_transactions
FOR EACH ROW EXECUTE FUNCTION cp_log_installation_audit();

CREATE OR REPLACE FUNCTION cp_log_boq_audit() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO cp_entry_audit_logs(process, action, project_id, item_id, transaction_date, qty, status_to, details)
    VALUES ('boq', CASE WHEN NEW.status='approved' THEN 'Confirm BOQ' WHEN NEW.status='saved' THEN 'Save BOQ' ELSE 'Entry BOQ' END,
            NEW.project_id, NEW.item_id, NULL, NEW.planned_qty, NEW.status, 'BOQ row created');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO cp_entry_audit_logs(process, action, project_id, item_id, transaction_date, qty, status_from, status_to, details)
    VALUES ('boq', CASE WHEN OLD.status <> NEW.status AND NEW.status='approved' THEN 'Confirm BOQ'
                        WHEN OLD.status <> NEW.status AND NEW.status='saved' THEN 'Save BOQ'
                        ELSE 'Update BOQ' END,
            NEW.project_id, NEW.item_id, NULL, NEW.planned_qty, OLD.status, NEW.status, 'BOQ qty/status updated');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO cp_entry_audit_logs(process, action, project_id, item_id, transaction_date, qty, status_from, details)
    VALUES ('boq', 'Delete BOQ', OLD.project_id, OLD.item_id, NULL, OLD.planned_qty, OLD.status, 'BOQ row deleted');
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cp_boq_audit ON cp_project_planning;
CREATE TRIGGER trg_cp_boq_audit AFTER INSERT OR UPDATE OR DELETE ON cp_project_planning
FOR EACH ROW EXECUTE FUNCTION cp_log_boq_audit();
