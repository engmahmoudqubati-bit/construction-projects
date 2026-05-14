import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import t from '../lang';

export default function Login() {
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const [form, setForm]       = useState({ username: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [remember, setRemember] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(form);
      login(res.token, res.user, res.permissions);
      navigate('/overview', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  const bgUrl = `${import.meta.env.BASE_URL}login-bg.png`;

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>

      {/* ── LEFT PANEL ── */}
      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
        {/* Background photo */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url('${bgUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        {/* Dark overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.50)',
        }} />

        {/* Top: Logo */}
        <div style={{ position: 'relative', zIndex: 5, padding: '32px 40px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(233,115,22,0.25)', border: '1.5px solid rgba(233,115,22,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e97316" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Construction Project</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Management System</div>
          </div>
        </div>

        {/* Center: Headline */}
        <div style={{ position: 'relative', zIndex: 5, padding: '0 40px' }}>
          <div style={{ fontSize: 13, color: '#e97316', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 2, background: '#e97316' }} />
            Enterprise Platform
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 16 }}>
            Plan. Build. Manage.<br/>
            <span style={{ color: '#e97316' }}>Deliver Excellence.</span>
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
            Streamline your construction projects<br/>from planning to completion.
          </p>
        </div>

        {/* Bottom: Feature icons */}
        <div style={{ position: 'relative', zIndex: 5, padding: '32px 40px', display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          {[
            { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, label: 'Project', sub: 'Planning' },
            { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, label: 'Progress', sub: 'Tracking' },
            { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>, label: 'Team', sub: 'Collaboration' },
            { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, label: 'Quality', sub: 'Control' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ color: 'rgba(255,255,255,0.55)' }}>{item.icon}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        width: 440,
        minWidth: 380,
        flexShrink: 0,
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        position: 'relative',
        zIndex: 10,
        boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
      }}>
        {/* Grid background */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'repeating-linear-gradient(0deg,#888 0,#888 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#888 0,#888 1px,transparent 1px,transparent 40px)' }} />

        <div style={{ width: '100%', maxWidth: 360, position: 'relative' }}>
          {/* Company logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', border: '1px solid #f0e8d8', borderRadius: 12, background: '#fffaf5' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e97316" strokeWidth="1.5"><path d="M2 20h20M4 20V10L12 4l8 6v10"/><path d="M10 20v-6h4v6"/></svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a0e00', direction: 'rtl' }}>شعار الشركة</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Company Logo</div>
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: 6 }}>Welcome Back!</h2>
          <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', marginBottom: 28 }}>Sign in to continue to your account</p>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
              ⚠ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 }}>Username</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: 12, color: '#9ca3af', display: 'flex', pointerEvents: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
                <input
                  style={{ width: '100%', padding: '11px 12px 11px 40px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', color: '#111827', background: '#f9fafb', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="Enter username"
                  autoComplete="username"
                  onFocus={e => { e.target.style.borderColor = '#e97316'; e.target.style.background = '#fff'; }}
                  onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 }}>Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: 12, color: '#9ca3af', display: 'flex', pointerEvents: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                </span>
                <input
                  style={{ width: '100%', padding: '11px 40px 11px 40px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', color: '#111827', background: '#f9fafb', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  onFocus={e => { e.target.style.borderColor = '#e97316'; e.target.style.background = '#fff'; }}
                  onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, display: 'flex', alignItems: 'center' }}>
                  {showPw
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: '#e97316', cursor: 'pointer' }} />
                Remember me
              </label>
              <span style={{ fontSize: 13, color: '#e97316', fontWeight: 500, cursor: 'pointer' }}>Forgot Password?</span>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '13px', background: '#e97316', color: '#fff', border: 'none', borderRadius: 24, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, boxShadow: '0 4px 14px rgba(233,115,22,0.4)' }}>
              {loading ? 'Signing in...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}