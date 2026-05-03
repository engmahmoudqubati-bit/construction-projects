const en = {
  appName: 'Construction PM',

  // Nav sections
  dashboard: 'Dashboard',
  definitions: 'Definitions',
  planning: 'Planning',
  transactions: 'Transactions',
  reports: 'Reports',

  // Nav items
  users: 'Users',
  projects: 'Projects',
  itemClassifications: 'Item Classifications',
  items: 'Items',
  delivery: 'Delivery',
  installation: 'Installation',
  inspection: 'Inspection',

  // Actions
  add: 'Add',
  edit: 'Edit',
  delete: 'Delete',
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  search: 'Search...',
  loading: 'Loading...',
  saving: 'Saving...',
  confirm: 'Confirm',

  // Auth
  login: 'Sign In',
  logout: 'Logout',
  username: 'Username',
  password: 'Password',
  newPassword: 'New Password',
  leaveBlankPassword: 'Leave blank to keep current password',
  loginSubtitle: 'Sign in to your account',

  // User fields
  fullName: 'Full Name',
  role: 'Role',
  email: 'Email',
  status: 'Status',
  active: 'Active',
  inactive: 'Inactive',
  addUser: 'Add User',
  editUser: 'Edit User',
  roles: {
    admin: 'Admin',
    project_manager: 'Project Manager',
    site_engineer: 'Site Engineer',
  },

  // Permissions
  pagePermissions: 'Page Permissions',
  projectAccess: 'Project Access',
  permissionsNote: 'Admin has full access — permissions apply to PM and Site Engineer only.',

  // Project fields
  projectCode: 'Project Code',
  projectNameEn: 'Project Name (English)',
  projectNameAr: 'Project Name (Arabic)',
  location: 'Location',
  client: 'Client',
  startDate: 'Start Date',
  endDate: 'End Date',
  manager: 'Manager',
  addProject: 'Add Project',
  editProject: 'Edit Project',
  statuses: {
    active: 'Active',
    completed: 'Completed',
    on_hold: 'On Hold',
    cancelled: 'Cancelled',
  },

  // Classification fields
  classificationCode: 'Code',
  classificationName: 'Name',
  parentClassification: 'Parent Classification',
  topLevel: '— Top Level —',
  addClassification: 'Add Classification',
  editClassification: 'Edit Classification',

  // Item fields
  itemCode: 'Item Code',
  itemName: 'Item Name',
  classification: 'Classification',
  unitOfMeasure: 'Unit',
  addItem: 'Add Item',
  editItem: 'Edit Item',

  // Planning
  plannedQty: 'Planned Qty',
  planningTitle: 'Project Planning',
  selectProjectToStart: 'Select a project to set up its planned quantities',
  noItemsAvailable: 'No active items available. Add items in Definitions first.',
  savePlanning: 'Save Planning',

  // Transactions
  selectProject: 'Select Project',
  allProjects: 'All Projects',
  selectDate: 'Select Date',
  qtyDelivered: 'Qty Delivered',
  qtyInstalled: 'Qty Installed',
  qtyInspected: 'Qty Inspected',
  deliveryRef: 'Delivery Ref',
  notes: 'Notes',
  remarks: 'Remarks',
  inspectionStatus: 'Result',
  totalDelivered: 'Total Delivered',
  totalInstalled: 'Total Installed',
  totalInspected: 'Total Inspected',
  progress: 'Progress',
  saveEntries: 'Save Entries',
  noItemsLinked: 'No items have been planned for this project yet.',

  // Dashboard KPIs
  totalProjects: 'Total Projects',
  installationProgress: 'Installation Progress',
  deliveryProgress: 'Delivery Progress',
  inspectionProgress: 'Inspection Progress',
  passRate: 'Pass Rate',
  installationByItem: 'Installation by Item',
  deliveryByItem: 'Delivery by Item',
  inspectionResults: 'Inspection Results',
  planned: 'Planned',
  installed: 'Installed',
  delivered: 'Delivered',
  inspected: 'Inspected',
  pass: 'Pass',
  fail: 'Fail',
  pending: 'Pending',

  // Reports tabs
  reportProgress: 'Planning vs Delivery vs Installation',
  reportProjectsSummary: 'Project Summary',
  reportItemTracking: 'Item Tracking',
  reportInspection: 'Inspection Report',
  installPct: 'Install %',
  deliveryPct: 'Delivery %',

  // Misc
  confirmDelete: 'Are you sure you want to delete this record? This cannot be undone.',
  noData: 'No data available',
  errorOccurred: 'An error occurred. Please try again.',
  saveSuccess: 'Saved successfully',
  deleteSuccess: 'Deleted successfully',
};

export default en;
