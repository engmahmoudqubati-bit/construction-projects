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

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(form);
      login(res.token, res.user, res.permissions);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      {/* ── Background: dark construction photo simulation ── */}
      <div className="login-bg">
        {/* Architectural grid lines - top-left */}
        <svg className="login-bg-svg" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice">
          {/* Sky gradient rect */}
          <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#1a1208"/>
              <stop offset="40%"  stopColor="#2d1e0a"/>
              <stop offset="100%" stopColor="#0d0d0d"/>
            </linearGradient>
            <linearGradient id="buildGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#1a120a"/>
              <stop offset="100%" stopColor="#2a1e0e"/>
            </linearGradient>
          </defs>
          <rect width="1400" height="900" fill="url(#skyGrad)"/>

          {/* Large glass building left */}
          <rect x="0" y="80" width="420" height="820" fill="#1c1408"/>
          {/* Window grid left building */}
          {Array.from({ length: 16 }).map((_, row) =>
            Array.from({ length: 7 }).map((_, col) => {
              const lit = Math.random() > 0.35;
              return (
                <rect key={`${row}-${col}`}
                  x={18 + col * 56} y={100 + row * 48}
                  width={42} height={34} rx={1}
                  fill={lit ? '#c47a1a' : '#0f0c06'}
                  opacity={lit ? 0.85 : 1}
                />
              );
            })
          )}
          {/* Building reflection sheen */}
          <rect x="0" y="80" width="420" height="820" fill="url(#buildGrad)" opacity="0.3"/>

          {/* Large glass building right */}
          <rect x="900" y="120" width="500" height="780" fill="#181210"/>
          {Array.from({ length: 14 }).map((_, row) =>
            Array.from({ length: 8 }).map((_, col) => {
              const lit = Math.random() > 0.4;
              return (
                <rect key={`r${row}-${col}`}
                  x={918 + col * 58} y={140 + row * 52}
                  width={44} height={38} rx={1}
                  fill={lit ? '#b86e14' : '#100e08'}
                  opacity={lit ? 0.8 : 1}
                />
              );
            })
          )}

          {/* Warm light glow at bottom */}
          <ellipse cx="700" cy="900" rx="700" ry="200"
            fill="rgba(180,100,20,0.18)"/>

          {/* Street/ground */}
          <rect x="0" y="820" width="1400" height="80" fill="#0a0806"/>

          {/* Overlay darken */}
          <rect width="1400" height="900" fill="rgba(0,0,0,0.45)"/>
        </svg>
      </div>

      {/* ── Right panel: login card ── */}
      <div className="login-panel">
        <div className="login-card-new">
          {/* Company logo area */}
          <div className="login-logo-area">
            <div className="login-logo-placeholder">
              <span style={{ fontSize: 32 }}>🏗️</span>
              <div style={{ lineHeight: 1 }}>
                <div style={{ fontSize: 10, color: '#888', letterSpacing: '0.05em' }}>شعار الشركة</div>
                <div style={{ fontSize: 11, color: '#aaa', letterSpacing: '0.05em' }}>Company Logo</div>
              </div>
            </div>
          </div>

          <h2 className="login-welcome">Welcome Back !</h2>

          {error && (
            <div className="login-err-box">⚠ {error}</div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div className="login-field">
              <label className="login-label">{t.username}</label>
              <div className="login-input-wrap">
                <span className="login-field-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                </span>
                <input
                  className="login-input-new"
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div className="login-field">
              <label className="login-label">{t.password}</label>
              <div className="login-input-wrap">
                <span className="login-field-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                </span>
                <input
                  className="login-input-new"
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: 40 }}
                />
                <button type="button" className="login-pw-eye" onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                  {showPw
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
