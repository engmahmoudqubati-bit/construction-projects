import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import t from '../../lang';

const NAV = [
  { label: t.dashboard, icon: '◈', path: '/dashboard', pageKey: null },

  { section: t.definitions },
  { label: t.users,              icon: '👥', path: '/definitions/users',           role: 'admin' },
  { label: t.projects,           icon: '🏗️', path: '/definitions/projects',        pageKey: 'definitions_projects' },
  { label: t.itemClassifications,icon: '🗂️', path: '/definitions/classifications',  pageKey: 'definitions_classifications' },
  { label: t.items,              icon: '📦', path: '/definitions/items',            pageKey: 'definitions_items' },

  { section: t.planning },
  { label: t.planning,   icon: '📋', path: '/planning',                    pageKey: 'planning' },

  { section: t.transactions },
  { label: t.delivery,     icon: '🚚', path: '/transactions/delivery',     pageKey: 'delivery' },
  { label: t.installation, icon: '🔧', path: '/transactions/installation', pageKey: 'installation' },
  { label: t.inspection,   icon: '🔍', path: '/transactions/inspection',   pageKey: 'inspection' },

  { section: t.reports },
  { label: t.reports, icon: '📊', path: '/reports', pageKey: 'reports' },
];

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, canAccessPage, logout } = useAuth();

  function isVisible(item) {
    if (item.role) return user?.role === item.role;
    if (item.pageKey === null) return true;           // dashboard — always visible
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
        <span className="logo-text">{t.appName}</span>
      </div>

      <div className="sidebar-nav">
        {NAV.map((item, i) => {
          if (item.section) {
            return <div key={i} className="nav-section-label">{item.section}</div>;
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
              <span className="nav-label">{item.label}</span>
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
          <span className="nav-label">{t.logout}</span>
        </button>
      </div>
    </nav>
  );
}
