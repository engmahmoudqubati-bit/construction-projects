import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

const PAGES = [
  'planning','delivery','installation','inspection','reports',
  'definitions_projects','definitions_classifications','definitions_items',
];

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export function AuthProvider({ children }) {
  const [user]        = useState(() => load('cp_user', null));
  const [token]       = useState(() => localStorage.getItem('cp_token') || null);
  const [permissions] = useState(() => load('cp_permissions', { pages: [], projects: [] }));

  const [state, setState] = useState({ user, token, permissions });

  function login(tokenVal, userData, perms) {
    const safePerms = perms || { pages: [], projects: [] };
    localStorage.setItem('cp_token',       tokenVal);
    localStorage.setItem('cp_user',        JSON.stringify(userData));
    localStorage.setItem('cp_permissions', JSON.stringify(safePerms));
    setState({ token: tokenVal, user: userData, permissions: safePerms });
  }

  function logout() {
    ['cp_token','cp_user','cp_permissions'].forEach(k => localStorage.removeItem(k));
    setState({ token: null, user: null, permissions: { pages: [], projects: [] } });
  }

  function canAccessPage(pageKey) {
    if (!state.user) return false;
    if (state.user.role === 'admin') return true;
    return state.permissions.pages.includes(pageKey);
  }

  function canAccessProject(projectId) {
    if (!state.user) return false;
    if (state.user.role === 'admin') return true;
    return state.permissions.projects.includes(Number(projectId));
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, canAccessPage, canAccessProject, ALL_PAGES: PAGES }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
