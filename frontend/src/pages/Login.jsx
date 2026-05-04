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
    <div style={styles.page}>
      {/* Animated background */}
      <div style={styles.bgLayer}>
        <div style={styles.bgGlow1} />
        <div style={styles.bgGlow2} />
        <div style={styles.bgGlow3} />
        <svg style={styles.bgGrid} xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Left panel — branding */}
      <div style={styles.leftPanel}>
        <div style={styles.brandBox}>
          <div style={styles.brandIcon}>🏗️</div>
          <h1 style={styles.brandTitle}>Construction PM</h1>
          <p style={styles.brandSub}>Project Management System</p>

          <div style={styles.featureList}>
            {[
              { icon: '📋', text: 'Project Planning & Tracking' },
              { icon: '🚚', text: 'Delivery Management' },
              { icon: '🔧', text: 'Installation Monitoring' },
              { icon: '🔍', text: 'Inspection & Quality Control' },
              { icon: '📊', text: 'Real-time Reports & Analytics' },
            ].map((f, i) => (
              <div key={i} style={styles.featureItem}>
                <span style={styles.featureIcon}>{f.icon}</span>
                <span style={styles.featureText}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={styles.rightPanel}>
        <div style={styles.card}>
          {/* Card accent bar */}
          <div style={styles.cardAccent} />

          <div style={styles.cardHeader}>
            <div style={styles.cardLogo}>🏗️</div>
            <h2 style={styles.cardTitle}>Welcome Back</h2>
            <p style={styles.cardSub}>Sign in to your account</p>
          </div>

          {error && (
            <div style={styles.errorBox}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Username */}
            <div>
              <label style={styles.label}>Username</label>
              <div style={styles.inputWrap}>
                <span style={styles.inputIcon}>👤</span>
                <input
                  style={styles.input}
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="Enter your username"
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={styles.label}>Password</label>
              <div style={styles.inputWrap}>
                <span style={styles.inputIcon}>🔒</span>
                <input
                  style={{ ...styles.input, paddingRight: 44 }}
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  style={styles.pwToggle}
                  tabIndex={-1}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              ...styles.submitBtn,
              opacity: loading ? 0.75 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <span style={styles.btnSpinner} /> Signing in...
                </span>
              ) : 'Sign In →'}
            </button>
          </form>

          <p style={styles.footerText}>
            Construction Projects Management System
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    background: '#0a1628',
    position: 'relative',
    overflow: 'hidden',
  },
  bgLayer: {
    position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden',
  },
  bgGlow1: {
    position: 'absolute', width: 600, height: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(26,115,232,0.18) 0%, transparent 70%)',
    top: -200, left: -100,
  },
  bgGlow2: {
    position: 'absolute', width: 500, height: 500,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
    bottom: -150, right: 100,
  },
  bgGlow3: {
    position: 'absolute', width: 300, height: 300,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
    top: '40%', left: '40%',
  },
  bgGrid: {
    position: 'absolute', inset: 0,
  },

  // Left panel
  leftPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 48px',
    position: 'relative',
    zIndex: 1,
  },
  brandBox: {
    maxWidth: 420,
  },
  brandIcon: {
    fontSize: 52,
    marginBottom: 16,
    display: 'block',
    filter: 'drop-shadow(0 4px 12px rgba(26,115,232,0.4))',
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '-0.03em',
    lineHeight: 1.2,
    marginBottom: 8,
  },
  brandSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 40,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 36, height: 36,
    background: 'rgba(26,115,232,0.15)',
    border: '1px solid rgba(26,115,232,0.3)',
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, flexShrink: 0,
    textAlign: 'center', lineHeight: '36px',
  },
  featureText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: 500,
  },

  // Right panel
  rightPanel: {
    width: 440,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 32px',
    position: 'relative',
    zIndex: 1,
    background: 'rgba(255,255,255,0.03)',
    borderLeft: '1px solid rgba(255,255,255,0.06)',
    backdropFilter: 'blur(20px)',
  },
  card: {
    width: '100%',
    background: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    padding: '36px 32px 28px',
    boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
    position: 'relative',
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 4,
    background: 'linear-gradient(90deg, #1a73e8, #0ea5e9, #10b981)',
  },
  cardHeader: {
    textAlign: 'center',
    marginBottom: 28,
  },
  cardLogo: {
    fontSize: 40,
    marginBottom: 12,
    display: 'block',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0d1b2a',
    letterSpacing: '-0.02em',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: '#5a6a7e',
  },
  errorBox: {
    background: 'rgba(220,38,38,0.08)',
    border: '1px solid rgba(220,38,38,0.3)',
    color: '#dc2626',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 500,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: '#4a6a8a',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    fontSize: 15,
    pointerEvents: 'none',
    zIndex: 1,
  },
  input: {
    width: '100%',
    background: '#f4f8ff',
    border: '1.5px solid #d0dbe8',
    borderRadius: 10,
    color: '#0d1b2a',
    padding: '11px 12px 11px 40px',
    fontSize: 13,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    outline: 'none',
    boxSizing: 'border-box',
  },
  pwToggle: {
    position: 'absolute', right: 10,
    background: 'none', border: 'none',
    fontSize: 15, cursor: 'pointer',
    padding: 4, lineHeight: 1,
    color: '#5a6a7e',
  },
  submitBtn: {
    width: '100%',
    padding: '13px',
    background: 'linear-gradient(135deg, #1a73e8, #0ea5e9)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.02em',
    boxShadow: '0 4px 16px rgba(26,115,232,0.35)',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
    marginTop: 4,
  },
  btnSpinner: {
    display: 'inline-block',
    width: 14, height: 14,
    border: '2px solid rgba(255,255,255,0.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#8898aa',
    marginTop: 24,
    letterSpacing: '0.03em',
  },
};
