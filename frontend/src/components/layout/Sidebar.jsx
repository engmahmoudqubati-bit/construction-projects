import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import t from '../../lang';

const NAV = [
  { label: t.dashboard, icon: '◈', path: '/dashboard', pageKey: null },

  { section: t.definitions },
  { label: t.companies,          icon: '🏢', path: '/definitions/companies',      role: 'admin' },
  { label: t.positionRoles,      icon: '🎖️', path: '/definitions/position-roles', role: 'admin' },
  { label: t.users,              icon: '👥', path: '/definitions/users',           role: 'admin' },
  { label: t.projects,           icon: '🏗️', path: '/definitions/projects',        pageKey: 'definitions_projects' },
  { label: t.itemClassifications,icon: '🗂️', path: '/definitions/classifications',  pageKey: 'definitions_classifications' },
  { label: 'Measurements',       icon: '📐', path: '/definitions/measurements',      pageKey: 'definitions_measurements' },
  { label: t.items,              icon: '📦', path: '/definitions/items',            pageKey: 'definitions_items' },

  { section: 'BOQ' },
  { label: 'Bill of Quantity BOQ', icon: '📋', path: '/planning', pageKey: 'planning' },

  { section: t.transactions },
  { label: t.delivery,     icon: '🚚', path: '/transactions/delivery',     pageKey: 'delivery' },
  { label: t.installation, icon: '🔧', path: '/transactions/installation', pageKey: 'installation' },
  { label: t.inspection,   icon: '🔍', path: '/transactions/inspection',   pageKey: 'inspection' },

  { section: t.reports },
  { label: t.reports, icon: '📊', path: '/reports', pageKey: 'reports' },
  { label: 'Weekly Summary', icon: '📅', path: '/reports/weekly', pageKey: 'reports' },
];

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, canAccessPage, logout } = useAuth();

  function isVisible(item) {
    if (item.role) return user?.role === item.role;
    if (item.pageKey === null) return true;
    if (user?.role === 'admin') return true;
    return canAccessPage(item.pageKey);
  }

  function go(path) { navigate(path); onCloseMobile(); }

  const cls = ['sidebar', collapsed ? 'collapsed' : '', mobileOpen ? 'mobile-open' : '']
    .filter(Boolean).join(' ');

  return (
    <nav className={cls}>
      <div className="sidebar-logo">
        <span className="logo-icon">🏗️</span>
        {!collapsed && <span className="logo-text">CPMS</span>}
      </div>

      <div className="sidebar-nav">
        {NAV.map((item, i) => {
          if (item.section) {
            return (
              <div key={i} className="nav-section-label">
                {collapsed ? <span title={item.section}>—</span> : item.section}
              </div>
            );
          }
          if (!isVisible(item)) return null;
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              className={`nav-item${active ? ' active' : ''}`}
              onClick={() => go(item.path)}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </button>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <button
          className="nav-item"
          onClick={() => { logout(); navigate('/login'); }}
          title={collapsed ? 'Logout' : undefined}
        >
          <span className="nav-icon">🚪</span>
          {!collapsed && <span className="nav-label">{t.logout}</span>}
        </button>
      </div>
    </nav>
  );
}