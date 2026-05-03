import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
import t from '../../lang';

const TITLES = {
  '/dashboard':                    t.dashboard,
  '/definitions/companies':        t.companies,
  '/definitions/position-roles':   t.positionRoles,
  '/definitions/users':            t.users,
  '/definitions/projects':         t.projects,
  '/definitions/classifications':  t.itemClassifications,
  '/definitions/items':            t.items,
  '/planning':                     t.planning,
  '/transactions/delivery':        t.delivery,
  '/transactions/installation':    t.installation,
  '/transactions/inspection':      t.inspection,
  '/reports':                      t.reports,
};

export default function Header({ onToggleSidebar, onToggleMobile }) {
  const location = useLocation();
  const { user } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('cp_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cp_theme', theme);
  }, [theme]);

  return (
    <header className="header">
      <button className="icon-btn mobile-only" onClick={onToggleMobile}>☰</button>
      <button className="icon-btn desktop-only" onClick={onToggleSidebar} title="Toggle sidebar">☰</button>

      <span className="header-title">{TITLES[location.pathname] ?? t.appName}</span>

      <div className="header-actions">
        <button
          className="icon-btn"
          onClick={() => setTheme(th => th === 'dark' ? 'light' : 'dark')}
          title="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        {user && (
          <div className="user-chip">
            {user.photo_url
              ? <img src={user.photo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>👤</div>
            }
            <span>{user.full_name}</span>
            <span className={`badge badge-${user.role}`}>
              {t.roles[user.role] || user.role}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}