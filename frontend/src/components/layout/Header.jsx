import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import t from '../../lang';

const TITLES = {
  '/dashboard': t.dashboard,
  '/definitions/system-setup': 'System Setup',
  '/definitions/companies': t.companies,
  '/definitions/position-roles': t.positionRoles,
  '/definitions/users': t.users,
  '/definitions/projects': t.projects,
  '/definitions/classifications': t.itemClassifications,
  '/definitions/measurements': 'Measurements',
  '/definitions/items': t.items,
  '/planning': 'Bill of Quantity BOQ',
  '/transactions/delivery': t.delivery,
  '/transactions/installation': t.installation,
  '/transactions/inspection': t.inspection,
  '/reports/weekly': 'Weekly Summary',
  '/reports/daily-productivity': 'Daily Productivity',
  '/reports/floor-weekly': 'Floor Productivity',
  '/reports': t.reports,
};

const GROUPS = [
  { match: '/definitions', label: t.definitions || 'Definitions' },
  { match: '/planning', label: 'BOQ' },
  { match: '/transactions', label: t.transactions || 'Transactions' },
  { match: '/reports', label: t.reports || 'Reports' },
];

function HeaderIcon({ type }) {
  const props = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  const icons = {
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
    moon: <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></>,
    expand: <><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></>,
    collapse: <><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" /></>,
  };
  return <svg {...props}>{icons[type]}</svg>;
}

export default function Header({ onToggleSidebar }) {
  const location = useLocation();
  const { user } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('cp_theme') || 'light');
  const [fullscreen, setFullscreen] = useState(false);

  const pageTitle = TITLES[location.pathname] ?? t.appName;
  const groupLabel = useMemo(() => {
    const group = GROUPS.find(g => location.pathname.startsWith(g.match));
    return group?.label || 'Workspace';
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cp_theme', theme);
  }, [theme]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const displayName = user?.full_name_en || user?.full_name || user?.username || 'User';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

  return (
    <header className="header">
      <button className="icon-btn header-menu-btn" onClick={onToggleSidebar} title="Toggle sidebar">
        <HeaderIcon type="menu" />
      </button>

      <div className="header-page-block">
        <div className="header-breadcrumb">
          <span>{groupLabel}</span>
          <span className="breadcrumb-separator">/</span>
          <span>{pageTitle}</span>
        </div>
      </div>

      <div className="header-actions">
        <button
          className="icon-btn header-theme-btn"
          onClick={() => setTheme(th => th === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        >
          <HeaderIcon type={theme === 'dark' ? 'sun' : 'moon'} />
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        <button
          className="icon-btn"
          onClick={toggleFullscreen}
          title={fullscreen ? 'Exit Full Screen' : 'Full Screen'}
        >
          <HeaderIcon type={fullscreen ? 'collapse' : 'expand'} />
        </button>

        {user && (
          <div className="user-chip">
            {user.photo_url ? (
              <img src={user.photo_url} alt="" className="user-chip-photo" />
            ) : (
              <span className="user-chip-avatar">{initials}</span>
            )}
            <span className="user-chip-copy">
              <strong>{displayName}</strong>
              <small>{t.roles?.[user.role] || user.role}</small>
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
