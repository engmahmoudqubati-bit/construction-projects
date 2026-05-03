import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/shared/Toast';
import Sidebar from './components/layout/Sidebar';
import Header  from './components/layout/Header';
import Login   from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users              from './pages/definitions/Users';
import Projects           from './pages/definitions/Projects';
import ItemClassifications from './pages/definitions/ItemClassifications';
import Items              from './pages/definitions/Items';
import Planning           from './pages/planning/Planning';
import Delivery           from './pages/transactions/Delivery';
import Installation       from './pages/transactions/Installation';
import Inspection         from './pages/transactions/Inspection';
import Reports            from './pages/reports/Reports';

// Guards
function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function RequirePage({ pageKey, children }) {
  const { user, canAccessPage } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessPage(pageKey)) return <Navigate to="/dashboard" replace />;
  return children;
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppShell() {
  const { user } = useAuth();
  const [collapsed, setCollapsed]     = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*"      element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={`main-area${collapsed ? ' sidebar-collapsed' : ''}`}>
        <Header
          onToggleSidebar={() => setCollapsed(c => !c)}
          onToggleMobile={() => setMobileOpen(o => !o)}
        />
        <main className="page-content">
          <Routes>
            <Route path="/"         element={<Navigate to="/dashboard" replace />} />
            <Route path="/login"    element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />

            {/* Definitions — role-gated */}
            <Route path="/definitions/users" element={
              <RequireRole roles={['admin']}><Users /></RequireRole>
            } />
            <Route path="/definitions/projects" element={
              <RequirePage pageKey="definitions_projects"><Projects /></RequirePage>
            } />
            <Route path="/definitions/classifications" element={
              <RequirePage pageKey="definitions_classifications"><ItemClassifications /></RequirePage>
            } />
            <Route path="/definitions/items" element={
              <RequirePage pageKey="definitions_items"><Items /></RequirePage>
            } />

            {/* Planning */}
            <Route path="/planning" element={
              <RequirePage pageKey="planning"><Planning /></RequirePage>
            } />

            {/* Transactions */}
            <Route path="/transactions/delivery" element={
              <RequirePage pageKey="delivery"><Delivery /></RequirePage>
            } />
            <Route path="/transactions/installation" element={
              <RequirePage pageKey="installation"><Installation /></RequirePage>
            } />
            <Route path="/transactions/inspection" element={
              <RequirePage pageKey="inspection"><Inspection /></RequirePage>
            } />

            {/* Reports */}
            <Route path="/reports" element={
              <RequirePage pageKey="reports"><Reports /></RequirePage>
            } />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <AppShell />
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
