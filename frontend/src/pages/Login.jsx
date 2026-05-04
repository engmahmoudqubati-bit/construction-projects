import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import t from '../lang';

// ── Deterministic pseudo-random (no flicker on re-render) ──
function frand(seed) {
  const x = Math.sin(seed + 1) * 43758.5453;
  return x - Math.floor(x);
}

// Generate window rectangles for a building
function buildingWindows(cols, rows, x0, y0, cellW, cellH, gapX, gapY, seed = 0) {
  const rects = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = frand(seed + r * 100 + c) > 0.28;
      const bright = lit ? frand(seed + r * 50 + c * 3) : 0;
      let fill;
      if (!lit) {
        fill = '#040301';
      } else if (bright > 0.7) {
        fill = '#e8961e';
      } else if (bright > 0.45) {
        fill = '#c87820';
      } else {
        fill = '#a86018';
      }
      rects.push(
        <rect
          key={`${r}-${c}`}
          x={x0 + c * (cellW + gapX)}
          y={y0 + r * (cellH + gapY)}
          width={cellW}
          height={cellH}
          fill={fill}
          opacity={lit ? 0.88 : 1}
        />
      );
    }
  }
  return rects;
}

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
      {/* ── Background ── */}
      <div className="login-bg">
        <svg
          className="login-bg-svg"
          viewBox="0 0 1400 900"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#020100" />
              <stop offset="55%"  stopColor="#080501" />
              <stop offset="100%" stopColor="#150c03" />
            </linearGradient>
            <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#0f0803" />
              <stop offset="100%" stopColor="#000000" />
            </linearGradient>
            <linearGradient id="glassSheen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.04" />
              <stop offset="50%"  stopColor="#ffffff" stopOpacity="0.01" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="glassSheen2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.0" />
              <stop offset="40%"  stopColor="#ffffff" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
            </linearGradient>
            <radialGradient id="warmGlow" cx="35%" cy="95%" r="50%">
              <stop offset="0%"   stopColor="#c87020" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#c87020" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="warmGlow2" cx="85%" cy="95%" r="30%">
              <stop offset="0%"   stopColor="#a05010" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#a05010" stopOpacity="0" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Sky */}
          <rect width="1400" height="900" fill="url(#skyGrad)" />

          {/* ── MAIN LEFT BUILDING (glass curtain wall) ── */}
          {/* Structure frame */}
          <rect x="0" y="0" width="620" height="900" fill="#0a0703" />

          {/* Vertical structural columns */}
          {[0, 62, 124, 186, 248, 310, 372, 434, 496, 558, 620].map(x => (
            <rect key={x} x={x} y={0} width={3} height={900} fill="#0d0904" opacity={0.8} />
          ))}
          {/* Horizontal floor plates */}
          {Array.from({ length: 26 }, (_, i) => (
            <rect key={i} x={0} y={i * 34} width={623} height={2} fill="#0d0904" opacity={0.7} />
          ))}

          {/* Window panes — main left building */}
          {buildingWindows(9, 25, 6, 4, 54, 26, 8, 8, 1)}

          {/* Glass sheen / reflection overlay on main building */}
          <rect x="0" y="0" width="620" height="900" fill="url(#glassSheen)" />
          {/* Diagonal reflection streak */}
          <polygon points="80,0 280,0 200,900 0,900" fill="rgba(255,245,220,0.022)" />

          {/* ── SECOND LARGE BUILDING (right side, partial) ── */}
          <rect x="880" y="80" width="520" height="820" fill="#080601" />
          {/* Vertical columns */}
          {[880, 935, 990, 1045, 1100, 1155, 1210, 1265, 1320, 1375, 1400].map(x => (
            <rect key={x} x={x} y={80} width={2.5} height={820} fill="#0c0903" opacity={0.8} />
          ))}
          {/* Horizontal floors */}
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={i} x={880} y={80 + i * 37} width={520} height={2} fill="#0c0903" opacity={0.7} />
          ))}
          {/* Window panes — right building */}
          {buildingWindows(8, 20, 886, 84, 47, 29, 8, 8, 500)}
          {/* Sheen */}
          <rect x="880" y="80" width="520" height="820" fill="url(#glassSheen2)" />

          {/* ── SMALL BUILDINGS (depth / city) ── */}
          {/* Centre gap building */}
          <rect x="630" y="320" width="240" height="580" fill="#060402" />
          {buildingWindows(4, 14, 638, 330, 48, 32, 8, 8, 900)}

          {/* ── Ground floor / street ── */}
          <rect x="0" y="840" width="1400" height="60" fill="url(#groundGrad)" />
          <rect x="0" y="838" width="1400" height="4" fill="rgba(200,120,30,0.08)" />

          {/* ── Ambient warm glow from windows ── */}
          <rect width="1400" height="900" fill="url(#warmGlow)" />
          <rect width="1400" height="900" fill="url(#warmGlow2)" />

          {/* ── Final dark cinematic overlay ── */}
          <rect width="1400" height="900" fill="rgba(0,0,0,0.42)" />

          {/* ── Slight vignette edges ── */}
          <rect width="1400" height="900"
            fill="none"
            style={{ filter: 'none' }}
          />
          <rect x="0" y="0" width="200" height="900" fill="rgba(0,0,0,0.18)" />
          <rect x="1200" y="0" width="200" height="900" fill="rgba(0,0,0,0.22)" />
          <rect x="0" y="700" width="1400" height="200" fill="rgba(0,0,0,0.25)" />
        </svg>
      </div>

      {/* ── Right panel: login card ── */}
      <div className="login-panel">
        <div className="login-card-new">

          {/* Company logo area */}
          <div className="login-logo-area">
            <div className="login-logo-placeholder">
              <span style={{ fontSize: 32 }}>🏗️</span>
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.04em', direction:'rtl' }}>شعار الشركة</div>
                <div style={{ fontSize: 11, color: '#9ca3af', letterSpacing: '0.04em' }}>Company Logo</div>
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
                    <circle cx="12" cy="8" r="4"/>
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
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

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
