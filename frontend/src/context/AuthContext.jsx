import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

const PAGES = [
  'planning','delivery','installation','inspection','reports',
  'definitions_projects','definitions_classifications','definitions_items',
  'definitions_companies','definitions_users','definitions_position_roles',
];

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => ({
    user:        load('cp_user', null),
    token:       localStorage.getItem('cp_token') || null,
    permissions: load('cp_permissions', { pages: [], actions: [], projects: [] }),
  }));

  function login(tokenVal, userData, perms) {
    const safePerms = {
      pages:    perms?.pages    || [],
      actions:  perms?.actions  || [],
      projects: perms?.projects || [],
    };
    localStorage.setItem('cp_token',       tokenVal);
    localStorage.setItem('cp_user',        JSON.stringify(userData));
    localStorage.setItem('cp_permissions', JSON.stringify(safePerms));
    setState({ token: tokenVal, user: userData, permissions: safePerms });
  }

  function logout() {
    ['cp_token','cp_user','cp_permissions'].forEach(k => localStorage.removeItem(k));
    setState({ token: null, user: null, permissions: { pages: [], actions: [], projects: [] } });
  }

  function isAdmin() {
    return state.user?.role === 'admin';
  }

  function canAccessPage(pageKey) {
    if (!state.user) return false;
    if (isAdmin()) return true;
    return state.permissions.pages?.includes(pageKey);
  }

  // Check action permission: can_create, can_edit, can_delete, can_confirm, can_activate
  function canAction(actionKey) {
    if (!state.user) return false;
    if (isAdmin()) return true;
    return state.permissions.actions?.includes(actionKey);
  }

  function canAccessProject(projectId) {
    if (!state.user) return false;
    if (isAdmin()) return true;
    return state.permissions.projects?.includes(Number(projectId));
  }

  return (
    <AuthContext.Provider value={{
      ...state,
      login, logout,
      canAccessPage, canAction, canAccessProject,
      isAdmin,
      ALL_PAGES: PAGES,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}