-- ============================================================
-- Fix all foreign key relations — replace CASCADE with RESTRICT
-- where data integrity requires blocking the delete.
-- Safe to run multiple times.
-- ============================================================

-- ── cp_project_planning ──────────────────────────────────────
-- Block deleting a project that has planning
ALTER TABLE cp_project_planning
  DROP CONSTRAINT IF EXISTS cp_project_planning_project_id_fkey,
  ADD CONSTRAINT cp_project_planning_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES cp_projects(id) ON DELETE RESTRICT;

-- Block deleting an item that has planning
ALTER TABLE cp_project_planning
  DROP CONSTRAINT IF EXISTS cp_project_planning_item_id_fkey,
  ADD CONSTRAINT cp_project_planning_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES cp_items(id) ON DELETE RESTRICT;

-- ── cp_delivery_transactions ─────────────────────────────────
ALTER TABLE cp_delivery_transactions
  DROP CONSTRAINT IF EXISTS cp_delivery_transactions_project_id_fkey,
  ADD CONSTRAINT cp_delivery_transactions_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES cp_projects(id) ON DELETE RESTRICT;

ALTER TABLE cp_delivery_transactions
  DROP CONSTRAINT IF EXISTS cp_delivery_transactions_item_id_fkey,
  ADD CONSTRAINT cp_delivery_transactions_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES cp_items(id) ON DELETE RESTRICT;

-- ── cp_installation_transactions ─────────────────────────────
ALTER TABLE cp_installation_transactions
  DROP CONSTRAINT IF EXISTS cp_installation_transactions_project_id_fkey,
  ADD CONSTRAINT cp_installation_transactions_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES cp_projects(id) ON DELETE RESTRICT;

ALTER TABLE cp_installation_transactions
  DROP CONSTRAINT IF EXISTS cp_installation_transactions_item_id_fkey,
  ADD CONSTRAINT cp_installation_transactions_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES cp_items(id) ON DELETE RESTRICT;

-- ── cp_inspection_transactions ───────────────────────────────
ALTER TABLE cp_inspection_transactions
  DROP CONSTRAINT IF EXISTS cp_inspection_transactions_project_id_fkey,
  ADD CONSTRAINT cp_inspection_transactions_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES cp_projects(id) ON DELETE RESTRICT;

ALTER TABLE cp_inspection_transactions
  DROP CONSTRAINT IF EXISTS cp_inspection_transactions_item_id_fkey,
  ADD CONSTRAINT cp_inspection_transactions_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES cp_items(id) ON DELETE RESTRICT;

-- ── cp_item_classifications ──────────────────────────────────
-- Block deleting a parent classification that has children
ALTER TABLE cp_item_classifications
  DROP CONSTRAINT IF EXISTS cp_item_classifications_parent_id_fkey,
  ADD CONSTRAINT cp_item_classifications_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES cp_item_classifications(id) ON DELETE RESTRICT;

-- Block deleting a classification that has items
ALTER TABLE cp_items
  DROP CONSTRAINT IF EXISTS cp_items_classification_id_fkey,
  ADD CONSTRAINT cp_items_classification_id_fkey
    FOREIGN KEY (classification_id) REFERENCES cp_item_classifications(id) ON DELETE RESTRICT;

-- ── cp_users ─────────────────────────────────────────────────
-- Keep CASCADE on user page permissions (they are user-owned config)
-- Keep CASCADE on user project access (they are user-owned config)
-- Keep SET NULL on engineer_id/inspector_id/manager_id (acceptable)

-- ── cp_companies ─────────────────────────────────────────────
-- Block deleting a holding company that has child organizations
ALTER TABLE cp_companies
  DROP CONSTRAINT IF EXISTS cp_companies_parent_id_fkey,
  ADD CONSTRAINT cp_companies_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES cp_companies(id) ON DELETE RESTRICT;

-- Block deleting a position role that has users (already done in route, now enforce at DB level)
ALTER TABLE cp_users
  DROP CONSTRAINT IF EXISTS cp_users_position_role_id_fkey,
  ADD CONSTRAINT cp_users_position_role_id_fkey
    FOREIGN KEY (position_role_id) REFERENCES cp_position_roles(id) ON DELETE RESTRICT;

-- Keep SET NULL on company_id for users (user can exist without a company)