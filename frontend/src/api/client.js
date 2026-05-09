const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getToken() { return localStorage.getItem('cp_token'); }

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method, headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    ['cp_token','cp_user','cp_permissions'].forEach(k => localStorage.removeItem(k));
    window.location.hash = '#/login';
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
  return data;
}

const qs = (params) => '?' + new URLSearchParams(
  Object.fromEntries(Object.entries(params).filter(([,v]) => v !== undefined && v !== null))
).toString();

export const api = {
  login: (b) => request('POST', '/api/auth/login', b),
  me:    ()  => request('GET',  '/api/auth/me'),

  getUsers:     ()       => request('GET',    '/api/users'),
  createUser:   (b)      => request('POST',   '/api/users', b),
  updateUser:   (id, b)  => request('PUT',    `/api/users/${id}`, b),
  toggleUser:   (id)     => request('PATCH',  `/api/users/${id}/toggle-active`),
  deleteUser:   (id)     => request('DELETE', `/api/users/${id}`),
  getUserPerms: (id)     => request('GET',    `/api/users/${id}/permissions`),

  getCompanies:  ()      => request('GET',    '/api/companies'),
  createCompany: (b)     => request('POST',   '/api/companies', b),
  updateCompany: (id, b) => request('PUT',    `/api/companies/${id}`, b),
  deleteCompany: (id)    => request('DELETE', `/api/companies/${id}`),

  getPositionRoles:     ()      => request('GET',    '/api/position-roles'),
  createPositionRole:   (b)     => request('POST',   '/api/position-roles', b),
  updatePositionRole:   (id, b) => request('PUT',    `/api/position-roles/${id}`, b),
  deletePositionRole:   (id)    => request('DELETE', `/api/position-roles/${id}`),
  getPositionRolePerms: (id)    => request('GET',    `/api/position-roles/${id}/permissions`),

  getProjects:   ()      => request('GET',    '/api/projects'),
  getProject:    (id)    => request('GET',    `/api/projects/${id}`),
  createProject: (b)     => request('POST',   '/api/projects', b),
  updateProject: (id, b) => request('PUT',    `/api/projects/${id}`, b),
  deleteProject: (id)    => request('DELETE', `/api/projects/${id}`),

  getClassifications:   ()      => request('GET',    '/api/classifications'),
  createClassification: (b)     => request('POST',   '/api/classifications', b),
  updateClassification: (id, b) => request('PUT',    `/api/classifications/${id}`, b),
  deleteClassification: (id)    => request('DELETE', `/api/classifications/${id}`),

  getItems:       ()      => request('GET',    '/api/items'),
  getMeasurements:       ()      => request('GET',    '/api/measurements'),
  createMeasurement:     (d)     => request('POST',   '/api/measurements', d),
  updateMeasurement:     (id, d) => request('PUT',    '/api/measurements/' + id, d),
  deleteMeasurement:     (id)    => request('DELETE', '/api/measurements/' + id),
  getNextItemCode:(clsId) => request('GET',    `/api/items/next-code/${clsId}`),
  createItem:     (b)     => request('POST',   '/api/items', b),
  updateItem:     (id, b) => request('PUT',    `/api/items/${id}`, b),
  deleteItem:     (id)    => request('DELETE', `/api/items/${id}`),

  getPlanning:          (pid)    => request('GET',   `/api/planning/${pid}`),
  getAvailableItems:    (pid)    => request('GET',   `/api/planning/available-items/${pid}`),
  insertPlanningItems:  (b)      => request('POST',  '/api/planning/insert-items', b),
  savePlanning:         (b)      => request('POST',  '/api/planning', b),
  preparePlanning:      (pid)    => request('PATCH', `/api/planning/prepare/${pid}`),
  confirmPlanning:      (pid)    => request('PATCH', `/api/planning/confirm/${pid}`),
  deletePlanningItem:   (pid, iid) => request('DELETE', `/api/planning/${pid}/${iid}`),
  draftPlanning:        (pid)    => request('PATCH',  `/api/planning/draft/${pid}`),
  savePlanningStatus:   (pid)    => request('PATCH',  `/api/planning/save/${pid}`),
  approvePlanning:      (pid)    => request('PATCH',  `/api/planning/approve/${pid}`),
  unpostPlanning:       (pid)    => request('PATCH',  `/api/planning/unpost/${pid}`),

  getDelivery:     (pid, date) => request('GET',  `/api/delivery${qs({ projectId: pid, date })}`),
  saveDelivery:    (b)         => request('POST', '/api/delivery', b),
  confirmDelivery: (project_id, transaction_date) => request('PATCH', '/api/delivery/confirm', { project_id, transaction_date }),
  unpostDelivery:  (project_id, transaction_date) => request('PATCH', '/api/delivery/unpost',  { project_id, transaction_date }),
  deleteDelivery:  (id) => request('DELETE', `/api/delivery/${id}`),
  getDeliveryTotals: (projectId) => request('GET', `/api/delivery/totals?projectId=${projectId}`),
  getInstallation:      (projectId, date) => request('GET', `/api/installation?projectId=${projectId}&date=${date}`),
  saveInstallation:     (body) => request('POST', '/api/installation', body),
  confirmInstallation:  (project_id, transaction_date) => request('PATCH', '/api/installation/confirm', { project_id, transaction_date }),
  unpostInstallation:   (project_id, transaction_date) => request('PATCH', '/api/installation/unpost',  { project_id, transaction_date }),
  deleteInstallation:   (id) => request('DELETE', `/api/installation/${id}`),
  getInstallationLevels:    (projectId) => request('GET', `/api/installation/levels?projectId=${projectId}`),
  saveInstallationLevels:   (body) => request('POST', '/api/installation/levels', body),
  deleteInstallationLevel:  (id) => request('DELETE', `/api/installation/levels/${id}`),
  getInstallationAllocation:(projectId) => request('GET', `/api/installation/allocation?projectId=${projectId}`),
  saveInstallationAllocation:(body) => request('POST', '/api/installation/allocation', body),
  getInstallationMap: (projectId) => request('GET', `/api/installation/map?projectId=${projectId}`),
  getDeliveryMatrix: (projectId) => request('GET', `/api/delivery/matrix?projectId=${projectId}`),


  getInspection:     (pid, date) => request('GET',  `/api/inspection${qs({ projectId: pid, date })}`),
  saveInspection:    (b)         => request('POST', '/api/inspection', b),
  confirmInspection: (project_id, transaction_date) => request('PATCH', '/api/inspection/confirm', { project_id, transaction_date }),

  getDashboardKpis:        (pid) => request('GET', `/api/dashboard/kpis${qs({ projectId: pid })}`),
  getInstallationProgress: (pid) => request('GET', `/api/dashboard/installation-progress${qs({ projectId: pid })}`),
  getInspectionStats:      (pid) => request('GET', `/api/dashboard/inspection-stats${qs({ projectId: pid })}`),
  getDeliveryProgress:     (pid) => request('GET', `/api/dashboard/delivery-progress${qs({ projectId: pid })}`),

  getWeeklyReport: (projectId, weekStart, weekEnd) => request('GET', `/api/reports/weekly?projectId=${projectId}&weekStart=${weekStart}&weekEnd=${weekEnd}`),
  getReportProgress:        (pid)    => request('GET', `/api/reports/progress${qs({ projectId: pid })}`),
  getReportProjectsSummary: ()       => request('GET', '/api/reports/projects-summary'),
  getReportItemTracking:    (params) => request('GET', `/api/reports/item-tracking${qs(params)}`),
  getReportInspection:      (pid)    => request('GET', `/api/reports/inspection${qs({ projectId: pid })}`),
};