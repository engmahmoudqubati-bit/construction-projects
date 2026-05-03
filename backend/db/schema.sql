-- ============================================================
-- Construction Projects Management System — Database Schema
-- Run against the shared Railway PostgreSQL instance
-- All tables prefixed cp_ to avoid conflicts with existing data
-- ============================================================

CREATE TABLE IF NOT EXISTS cp_users (
  id           SERIAL PRIMARY KEY,
  full_name    VARCHAR(100) NOT NULL,
  username     VARCHAR(50)  UNIQUE NOT NULL,
  password     VARCHAR(255) NOT NULL,
  role         VARCHAR(20)  NOT NULL CHECK (role IN ('admin','project_manager','site_engineer')),
  email        VARCHAR(100),
  is_active    BOOLEAN      DEFAULT true,
  created_at   TIMESTAMP    DEFAULT NOW()
);

-- Page/form access per user (admin bypasses this table entirely)
CREATE TABLE IF NOT EXISTS cp_user_page_permissions (
  id       SERIAL PRIMARY KEY,
  user_id  INTEGER NOT NULL REFERENCES cp_users(id) ON DELETE CASCADE,
  page_key VARCHAR(100) NOT NULL,
  UNIQUE(user_id, page_key)
);
-- Valid page_key values:
--   planning | delivery | installation | inspection | reports
--   definitions_projects | definitions_classifications | definitions_items

CREATE TABLE IF NOT EXISTS cp_projects (
  id               SERIAL PRIMARY KEY,
  project_code     VARCHAR(50)  UNIQUE NOT NULL,
  project_name_en  VARCHAR(200) NOT NULL,
  project_name_ar  VARCHAR(200),
  location         VARCHAR(200),
  client_name      VARCHAR(200),
  start_date       DATE,
  end_date         DATE,
  status           VARCHAR(20)  DEFAULT 'active'
                   CHECK (status IN ('active','completed','on_hold','cancelled')),
  manager_id       INTEGER REFERENCES cp_users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP DEFAULT NOW()
);

-- Which projects each non-admin user can see and interact with
CREATE TABLE IF NOT EXISTS cp_user_project_access (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES cp_users(id)    ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES cp_projects(id) ON DELETE CASCADE,
  UNIQUE(user_id, project_id)
);

-- 2-level classification hierarchy (parent_id NULL = top-level)
CREATE TABLE IF NOT EXISTS cp_item_classifications (
  id                  SERIAL PRIMARY KEY,
  classification_code VARCHAR(50)  UNIQUE NOT NULL,
  classification_name VARCHAR(200) NOT NULL,
  parent_id           INTEGER REFERENCES cp_item_classifications(id) ON DELETE SET NULL,
  is_active           BOOLEAN   DEFAULT true,
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cp_items (
  id                SERIAL PRIMARY KEY,
  item_code         VARCHAR(50)  UNIQUE NOT NULL,
  item_name         VARCHAR(200) NOT NULL,
  classification_id INTEGER REFERENCES cp_item_classifications(id) ON DELETE SET NULL,
  unit_of_measure   VARCHAR(50),
  is_active         BOOLEAN   DEFAULT true,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Project planning baseline (one row per project+item)
CREATE TABLE IF NOT EXISTS cp_project_planning (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES cp_projects(id) ON DELETE CASCADE,
  item_id     INTEGER NOT NULL REFERENCES cp_items(id)    ON DELETE CASCADE,
  planned_qty DECIMAL(12,3) NOT NULL CHECK (planned_qty > 0),
  UNIQUE(project_id, item_id)
);

CREATE TABLE IF NOT EXISTS cp_delivery_transactions (
  id               SERIAL PRIMARY KEY,
  project_id       INTEGER NOT NULL REFERENCES cp_projects(id) ON DELETE CASCADE,
  item_id          INTEGER NOT NULL REFERENCES cp_items(id)    ON DELETE CASCADE,
  transaction_date DATE    NOT NULL,
  qty_delivered    DECIMAL(12,3) NOT NULL CHECK (qty_delivered > 0),
  delivery_ref     VARCHAR(100),
  engineer_id      INTEGER REFERENCES cp_users(id) ON DELETE SET NULL,
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, item_id, transaction_date)
);

CREATE TABLE IF NOT EXISTS cp_installation_transactions (
  id               SERIAL PRIMARY KEY,
  project_id       INTEGER NOT NULL REFERENCES cp_projects(id) ON DELETE CASCADE,
  item_id          INTEGER NOT NULL REFERENCES cp_items(id)    ON DELETE CASCADE,
  transaction_date DATE    NOT NULL,
  qty_installed    DECIMAL(12,3) NOT NULL CHECK (qty_installed > 0),
  engineer_id      INTEGER REFERENCES cp_users(id) ON DELETE SET NULL,
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, item_id, transaction_date)
);

CREATE TABLE IF NOT EXISTS cp_inspection_transactions (
  id               SERIAL PRIMARY KEY,
  project_id       INTEGER NOT NULL REFERENCES cp_projects(id) ON DELETE CASCADE,
  item_id          INTEGER NOT NULL REFERENCES cp_items(id)    ON DELETE CASCADE,
  transaction_date DATE    NOT NULL,
  qty_inspected    DECIMAL(12,3) NOT NULL CHECK (qty_inspected > 0),
  status           VARCHAR(20) DEFAULT 'pending'
                   CHECK (status IN ('pass','fail','pending')),
  inspector_id     INTEGER REFERENCES cp_users(id) ON DELETE SET NULL,
  remarks          TEXT,
  created_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, item_id, transaction_date)
);

-- Run db/seed.js after this to create the default admin user
