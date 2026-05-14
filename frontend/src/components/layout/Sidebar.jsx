import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import t from '../../lang';

const NAV = [
  { label: 'Overview', icon: '⌂', path: '/overview', pageKey: null },
  { label: t.dashboard, icon: '▦', path: '/dashboard', pageKey: null },

  { section: t.definitions },
  { label: 'System Setup', icon: '⚙', path: '/definitions/system-setup', role: 'admin' },
  { label: t.companies, icon: '▣', path: '/definitions/companies', role: 'admin' },
  { label: t.positionRoles, icon: '◇', path: '/definitions/position-roles', role: 'admin' },
  { label: t.users, icon: '♙', path: '/definitions/users', role: 'admin' },
  { label: t.projects, icon: '▤', path: '/definitions/projects', pageKey: 'definitions_projects' },
  { label: t.itemClassifications, icon: '≡', path: '/definitions/classifications', pageKey: 'definitions_classifications' },
  { label: 'Measurements', icon: '⌁', path: '/definitions/measurements', pageKey: 'definitions_measurements' },
  { label: t.items, icon: '□', path: '/definitions/items', pageKey: 'definitions_items' },

  { section: 'BOQ' },
  { label: 'Bill of Quantity BOQ', icon: '▧', path: '/planning', pageKey: 'planning' },

  { section: t.transactions },
  { label: t.delivery, icon: '▸', path: '/transactions/delivery', pageKey: 'delivery' },
  { label: t.installation, icon: '⌘', path: '/transactions/installation', pageKey: 'installation' },
  { label: t.inspection, icon: '◎', path: '/transactions/inspection', pageKey: 'inspection' },

  { section: t.reports },
  { label: 'Weekly Summary', icon: '◷', path: '/reports/weekly', pageKey: 'reports' },
  { label: 'Daily Productivity', icon: '▥', path: '/reports/daily-productivity', pageKey: 'reports' },
  { label: 'Floor Productivity', icon: '▨', path: '/reports/floor-weekly', pageKey: 'reports' },
  { label: t.reports, icon: '↗', path: '/reports', pageKey: 'reports' },
];

function initials(user) {
  const name = user?.full_name || user?.name || user?.username || 'User';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join('') || 'U';
}

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile = () => {} }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, canAccessPage, logout } = useAuth();

  function isVisible(item) {
    if (item.role) return user?.role === item.role;
    if (item.pageKey === null) return true;
    if (user?.role === 'admin') return true;
    return canAccessPage(item.pageKey);
  }

  function go(path) {
    navigate(path);
    onCloseMobile();
  }

  const cls = ['sidebar cpms-sidebar-orange', collapsed ? 'collapsed' : '', mobileOpen ? 'mobile-open' : '']
    .filter(Boolean)
    .join(' ');

  const userName = user?.full_name || user?.name || user?.username || 'System User';
  const roleLabel = String(user?.role || 'User').toUpperCase();

  return (
    <nav className={cls}>
      <style>{sidebarStyles}</style>

      <div className="sidebar-logo cpms-sidebar-brand">
        <div className="cpms-logo-mark" aria-hidden="true">
          <span>▰</span>
        </div>
        {!collapsed && (
          <div className="cpms-brand-text">
            <strong>CPMS</strong>
            <small>Project Control</small>
          </div>
        )}
      </div>

      <div className="sidebar-nav cpms-sidebar-nav">
        {NAV.map((item, i) => {
          if (item.section) {
            return (
              <div key={`section-${i}`} className="nav-section-label cpms-section-label">
                {collapsed ? <span title={item.section}>•</span> : item.section}
              </div>
            );
          }

          if (!isVisible(item)) return null;
          const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(`${item.path}/`));

          return (
            <button
              key={item.path}
              className={`nav-item cpms-nav-item${active ? ' active' : ''}`}
              onClick={() => go(item.path)}
              title={collapsed ? item.label : undefined}
              type="button"
            >
              <span className="nav-icon cpms-nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label cpms-nav-label">{item.label}</span>}
            </button>
          );
        })}
      </div>

      <div className="sidebar-footer cpms-sidebar-footer">
        {!collapsed && (
          <div className="cpms-profile-card">
            <div className="cpms-avatar">{initials(user)}</div>
            <div className="cpms-profile-info">
              <strong title={userName}>{userName}</strong>
              <small>{roleLabel}</small>
            </div>
          </div>
        )}

        <button
          className="nav-item cpms-nav-item cpms-logout"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          title={collapsed ? 'Logout' : undefined}
          type="button"
        >
          <span className="nav-icon cpms-nav-icon">↪</span>
          {!collapsed && <span className="nav-label cpms-nav-label">{t.logout}</span>}
        </button>
      </div>
    </nav>
  );
}

const sidebarStyles = `
.cpms-sidebar-orange {
  --sb-bg: #ffffff;
  --sb-border: #e5e7eb;
  --sb-border-soft: #eef2f7;
  --sb-text: #334155;
  --sb-text-strong: #0f172a;
  --sb-muted: #94a3b8;
  --sb-label: #7c8798;
  --sb-blue: #2563eb;
  --sb-blue-dark: #1d4ed8;
  --sb-blue-soft: #eff6ff;
  --sb-blue-soft-2: #f8fbff;
  --sb-orange: #f97316;
  --sb-orange-dark: #c2410c;
  background: #ffffff !important;
  border-right: 1px solid var(--sb-border) !important;
  color: var(--sb-text) !important;
  box-shadow: 10px 0 30px rgba(15, 23, 42, 0.055) !important;
}

.cpms-sidebar-orange .cpms-sidebar-brand,
.cpms-sidebar-orange .sidebar-logo {
  height: 78px;
  padding: 16px 16px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #ffffff !important;
  border-bottom: 1px solid #f3e4d2 !important;
  box-shadow: none !important;
}

.cpms-logo-mark {
  width: 42px;
  height: 42px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: #ffffff;
  background: linear-gradient(145deg, #ff9a3d 0%, #f97316 52%, #ea580c 100%);
  box-shadow: 0 12px 24px rgba(249, 115, 22, 0.24), inset 0 1px 0 rgba(255,255,255,0.38);
}

.cpms-logo-mark span {
  font-size: 18px;
  transform: rotate(45deg);
  display: inline-block;
}

.cpms-brand-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.cpms-brand-text strong {
  color: #111827;
  font-size: 20px;
  line-height: 1;
  letter-spacing: -0.035em;
  font-weight: 900;
}

.cpms-brand-text small {
  color: var(--sb-orange-dark);
  font-size: 10px;
  letter-spacing: .12em;
  text-transform: uppercase;
  font-weight: 800;
}

.cpms-sidebar-orange .cpms-sidebar-nav,
.cpms-sidebar-orange .sidebar-nav {
  padding: 14px 10px 14px;
  display: grid;
  gap: 3px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: #bfdbfe #f8fafc;
  background: #ffffff !important;
}

.cpms-sidebar-orange .cpms-sidebar-nav::-webkit-scrollbar,
.cpms-sidebar-orange .sidebar-nav::-webkit-scrollbar {
  width: 6px;
}

.cpms-sidebar-orange .cpms-sidebar-nav::-webkit-scrollbar-track,
.cpms-sidebar-orange .sidebar-nav::-webkit-scrollbar-track {
  background: #f8fafc;
  border-radius: 999px;
}

.cpms-sidebar-orange .cpms-sidebar-nav::-webkit-scrollbar-thumb,
.cpms-sidebar-orange .sidebar-nav::-webkit-scrollbar-thumb {
  background: #bfdbfe;
  border-radius: 999px;
}

.cpms-sidebar-orange .cpms-section-label,
.cpms-sidebar-orange .nav-section-label {
  margin: 18px 12px 9px !important;
  padding: 0 0 0 2px !important;
  min-height: 16px !important;
  height: auto !important;
  line-height: 16px !important;
  display: flex !important;
  align-items: center !important;
  color: #8b95a6 !important;
  font-size: 10px !important;
  font-weight: 900 !important;
  letter-spacing: .16em !important;
  text-transform: uppercase !important;
  opacity: 1 !important;
  overflow: visible !important;
  white-space: nowrap !important;
  position: relative !important;
  z-index: 2 !important;
  background: #ffffff !important;
}

.cpms-sidebar-orange .cpms-section-label:first-child,
.cpms-sidebar-orange .nav-section-label:first-child {
  margin-top: 6px;
}

.cpms-sidebar-orange .cpms-nav-item,
.cpms-sidebar-orange .nav-item {
  min-height: 42px;
  width: 100%;
  border: 1px solid transparent;
  border-radius: 14px;
  background: #ffffff !important;
  color: var(--sb-text) !important;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 12px;
  margin: 2px 0;
  cursor: pointer;
  font-weight: 700;
  text-align: left;
  transition: background .18s ease, border-color .18s ease, color .18s ease, box-shadow .18s ease, transform .18s ease;
}

.cpms-sidebar-orange .cpms-nav-item:hover,
.cpms-sidebar-orange .nav-item:hover {
  background: var(--sb-blue-soft-2) !important;
  color: var(--sb-blue-dark) !important;
  border-color: #dbeafe !important;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.08) !important;
  transform: translateX(2px);
}

.cpms-sidebar-orange .cpms-nav-item.active,
.cpms-sidebar-orange .nav-item.active {
  background: linear-gradient(90deg, #eff6ff 0%, #f8fbff 100%) !important;
  color: var(--sb-text-strong) !important;
  border-color: #93c5fd !important;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.10), inset 3px 0 0 var(--sb-blue);
}

.cpms-sidebar-orange .cpms-nav-item.active::before,
.cpms-sidebar-orange .nav-item.active::before {
  display: none !important;
}

.cpms-sidebar-orange .cpms-nav-icon,
.cpms-sidebar-orange .nav-icon {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  display: inline-grid;
  place-items: center;
  flex: 0 0 28px;
  color: #64748b !important;
  background: #f8fafc !important;
  border: 1px solid #eef2f7 !important;
  font-size: 14px;
  font-weight: 900;
}

.cpms-sidebar-orange .cpms-nav-item:hover .cpms-nav-icon,
.cpms-sidebar-orange .nav-item:hover .nav-icon {
  color: var(--sb-blue-dark) !important;
  background: #ffffff !important;
  border-color: #bfdbfe !important;
}

.cpms-sidebar-orange .cpms-nav-item.active .cpms-nav-icon,
.cpms-sidebar-orange .nav-item.active .nav-icon {
  color: #ffffff !important;
  background: linear-gradient(145deg, #3b82f6, #2563eb) !important;
  border-color: #2563eb !important;
  box-shadow: 0 8px 18px rgba(37, 99, 235, .20);
}

.cpms-sidebar-orange .cpms-nav-label,
.cpms-sidebar-orange .nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: inherit !important;
}

.cpms-sidebar-orange .cpms-sidebar-footer,
.cpms-sidebar-orange .sidebar-footer {
  margin-top: auto;
  padding: 12px 10px 14px;
  background: #ffffff !important;
  border-top: 1px solid var(--sb-border) !important;
}

.cpms-profile-card {
  display: grid;
  grid-template-columns: 42px 1fr;
  align-items: center;
  gap: 10px;
  padding: 10px;
  margin: 0 0 8px;
  border-radius: 16px;
  background: #ffffff !important;
  border: 1px solid #dbeafe !important;
  box-shadow: 0 10px 22px rgba(37, 99, 235, .06);
  min-width: 0;
}

.cpms-avatar {
  width: 42px;
  height: 42px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, #ffffff 0%, #eff6ff 100%) !important;
  border: 1px solid #bfdbfe !important;
  color: var(--sb-blue-dark) !important;
  font-weight: 900;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
}

.cpms-profile-info {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.cpms-profile-info strong {
  color: #111827;
  font-size: 12px;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cpms-profile-info small {
  color: #64748b;
  font-size: 10px;
  letter-spacing: .08em;
  font-weight: 900;
}

.cpms-sidebar-orange .cpms-logout {
  color: #334155 !important;
  background: #ffffff !important;
  border-color: #dbeafe !important;
}

.cpms-sidebar-orange .cpms-logout .cpms-nav-icon,
.cpms-sidebar-orange .cpms-logout .nav-icon {
  color: #64748b !important;
  background: #f8fafc !important;
  border-color: #eef2f7 !important;
}

.cpms-sidebar-orange .cpms-logout:hover {
  color: #1d4ed8 !important;
  background: #eff6ff !important;
  border-color: #bfdbfe !important;
}

.cpms-sidebar-orange .cpms-logout:hover .cpms-nav-icon,
.cpms-sidebar-orange .cpms-logout:hover .nav-icon {
  color: #ffffff !important;
  background: linear-gradient(145deg, #3b82f6, #2563eb) !important;
  border-color: #2563eb !important;
}

.cpms-sidebar-orange.collapsed .cpms-sidebar-brand,
.cpms-sidebar-orange.collapsed .sidebar-logo {
  justify-content: center;
  padding-inline: 8px;
}

.cpms-sidebar-orange.collapsed .cpms-section-label,
.cpms-sidebar-orange.collapsed .nav-section-label {
  text-align: center;
  margin-inline: 0;
}

.cpms-sidebar-orange.collapsed .cpms-nav-item,
.cpms-sidebar-orange.collapsed .nav-item {
  justify-content: center;
  padding-inline: 8px;
}
`;
