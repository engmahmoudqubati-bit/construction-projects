import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import t from '../../lang';

const TITLES = {
  '/dashboard':                   t.dashboard,
  '/definitions/companies':       t.companies,
  '/definitions/position-roles':  t.positionRoles,
  '/definitions/users':           t.users,
  '/definitions/projects':        t.projects,
  '/definitions/classifications': t.itemClassifications,
  '/definitions/items':           t.items,
  '/planning':                    t.planning,
  '/transactions/delivery':       t.delivery,
  '/transactions/installation':   t.installation,
  '/transactions/inspection':     t.inspection,
  '/reports':                     t.reports,
};

export default function Header({ onToggleSidebar }) {
  const location   = useLocation();
  const { user }   = useAuth();
  const [theme,      setTheme]      = useState(() => localStorage.getItem('cp_theme') || 'light');
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cp_theme', theme);
  }, [theme]);

  // Full screen toggle — hides browser chrome (URL bar) via Fullscreen API
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

  const subtitle = location.pathname === '/definitions/projects'
    ? 'Manage and track all your construction projects in one place.'
    : null;

  return (
    <header className="header">
      <button className="icon-btn" onClick={onToggleSidebar} title="Toggle sidebar">☰</button>
      <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
        <span className="header-title">{TITLES[location.pathname] ?? t.appName}</span>
        {subtitle && <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:400 }}>{subtitle}</span>}
      </div>

      <div className="header-actions">
        {/* Dark / Light toggle with label */}
        <button
          className="icon-btn header-theme-btn"
          onClick={() => setTheme(th => th === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        >
          <span style={{ fontSize: 14 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 3 }}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </span>
        </button>

        {/* Full screen button */}
        <button
          className="icon-btn"
          onClick={toggleFullscreen}
          title={fullscreen ? 'Exit Full Screen' : 'Full Screen'}
        >
          {fullscreen
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/></svg>
          }
        </button>

        {user && (
          <div className="user-chip">
            {user.photo_url
              ? <img src={user.photo_url} alt="" style={{ width:26, height:26, borderRadius:'50%', objectFit:'cover' }} />
              : <span style={{ fontSize:16 }}>👤</span>
            }
            <span>{user.full_name_en || user.full_name}</span>
            <span className={`badge badge-${user.role}`}>{t.roles[user.role] || user.role}</span>
          </div>
        )}
      </div>
    </header>
  );
}