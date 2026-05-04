import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import t from '../lang';

const BG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice">
  <rect fill="#eef5ff" x="0" y="0" width="1400" height="900"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="0" y1="100" x2="1400" y2="100"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="0" y1="200" x2="1400" y2="200"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="0" y1="300" x2="1400" y2="300"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="0" y1="400" x2="1400" y2="400"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="0" y1="500" x2="1400" y2="500"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="0" y1="600" x2="1400" y2="600"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="0" y1="700" x2="1400" y2="700"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="0" y1="800" x2="1400" y2="800"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="100" y1="0" x2="100" y2="900"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="200" y1="0" x2="200" y2="900"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="300" y1="0" x2="300" y2="900"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="400" y1="0" x2="400" y2="900"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="500" y1="0" x2="500" y2="900"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="600" y1="0" x2="600" y2="900"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="700" y1="0" x2="700" y2="900"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="800" y1="0" x2="800" y2="900"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="900" y1="0" x2="900" y2="900"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="1000" y1="0" x2="1000" y2="900"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="1100" y1="0" x2="1100" y2="900"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="1200" y1="0" x2="1200" y2="900"/>
  <line stroke="#c4d6f0" stroke-width="1" x1="1300" y1="0" x2="1300" y2="900"/>
  <rect fill="#e2edf8" stroke="#b0c8e4" stroke-width="1.5" x="0" y="760" width="1400" height="140"/>
  <rect fill="#dce8f6" stroke="#a8c0dc" stroke-width="1.5" x="80" y="340" width="160" height="420"/>
  <rect fill="#d8e4f4" stroke="#a0b8d8" stroke-width="1.5" x="0" y="500" width="74" height="260"/>
  <rect fill="#ccd8f0" stroke="#98b0d0" stroke-width="1.5" x="1160" y="240" width="180" height="520"/>
  <rect fill="#d4e0f2" stroke="#a0b8d4" stroke-width="1.5" x="1356" y="480" width="44" height="280"/>
  <rect fill="#dae6f4" stroke="#a4bcd6" stroke-width="1.5" x="580" y="480" width="320" height="280"/>
  <rect fill="#ccd8f0" stroke="#a0b4d4" stroke-width="1.2" x="580" y="480" width="320" height="280"/>
  <line stroke="#b4c8e4" stroke-width="1" x1="580" y1="540" x2="900" y2="540"/>
  <line stroke="#b4c8e4" stroke-width="1" x1="580" y1="600" x2="900" y2="600"/>
  <line stroke="#b4c8e4" stroke-width="1" x1="580" y1="660" x2="900" y2="660"/>
  <line stroke="#b4c8e4" stroke-width="1" x1="580" y1="720" x2="900" y2="720"/>
  <line stroke="#b4c8e4" stroke-width="1" x1="640" y1="480" x2="640" y2="760"/>
  <line stroke="#b4c8e4" stroke-width="1" x1="700" y1="480" x2="700" y2="760"/>
  <line stroke="#b4c8e4" stroke-width="1" x1="760" y1="480" x2="760" y2="760"/>
  <line stroke="#b4c8e4" stroke-width="1" x1="820" y1="480" x2="820" y2="760"/>
  <line stroke="#b4c8e4" stroke-width="1" x1="880" y1="480" x2="880" y2="760"/>
  <rect fill="#d8e6f6" stroke="#a4bcda" stroke-width="1.5" x="83" y="350" width="154" height="410"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="93" y="360" width="20" height="26" rx="1"/>
  <rect fill="#c0d0ea" stroke="#90a8c4" stroke-width="1.2" x="121" y="360" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="149" y="360" width="20" height="26" rx="1"/>
  <rect fill="#c0d0ea" stroke="#90a8c4" stroke-width="1.2" x="177" y="360" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="93" y="398" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="121" y="398" width="20" height="26" rx="1"/>
  <rect fill="#c0d0ea" stroke="#90a8c4" stroke-width="1.2" x="149" y="398" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="177" y="398" width="20" height="26" rx="1"/>
  <rect fill="#c0d0ea" stroke="#90a8c4" stroke-width="1.2" x="93" y="436" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="121" y="436" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="149" y="436" width="20" height="26" rx="1"/>
  <rect fill="#c0d0ea" stroke="#90a8c4" stroke-width="1.2" x="177" y="436" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="93" y="474" width="20" height="26" rx="1"/>
  <rect fill="#c0d0ea" stroke="#90a8c4" stroke-width="1.2" x="121" y="474" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="149" y="474" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="177" y="474" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="93" y="512" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="121" y="512" width="20" height="26" rx="1"/>
  <rect fill="#c0d0ea" stroke="#90a8c4" stroke-width="1.2" x="149" y="512" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="177" y="512" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="93" y="550" width="20" height="26" rx="1"/>
  <rect fill="#c0d0ea" stroke="#90a8c4" stroke-width="1.2" x="121" y="550" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="149" y="550" width="20" height="26" rx="1"/>
  <rect fill="#c0d0ea" stroke="#90a8c4" stroke-width="1.2" x="177" y="550" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="93" y="588" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="121" y="588" width="20" height="26" rx="1"/>
  <rect fill="#c0d0ea" stroke="#90a8c4" stroke-width="1.2" x="149" y="588" width="20" height="26" rx="1"/>
  <rect fill="#c8d8ee" stroke="#98b0cc" stroke-width="1.2" x="177" y="588" width="20" height="26" rx="1"/>
  <rect fill="#d0dcf0" stroke="#9cB4cc" stroke-width="1.5" x="1163" y="250" width="174" height="510"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1173" y="264" width="22" height="28" rx="1"/>
  <rect fill="#bcccea" stroke="#90a8c2" stroke-width="1.2" x="1203" y="264" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1233" y="264" width="22" height="28" rx="1"/>
  <rect fill="#bcccea" stroke="#90a8c2" stroke-width="1.2" x="1263" y="264" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1293" y="264" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1173" y="304" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1203" y="304" width="22" height="28" rx="1"/>
  <rect fill="#bcccea" stroke="#90a8c2" stroke-width="1.2" x="1233" y="304" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1263" y="304" width="22" height="28" rx="1"/>
  <rect fill="#bcccea" stroke="#90a8c2" stroke-width="1.2" x="1293" y="304" width="22" height="28" rx="1"/>
  <rect fill="#bcccea" stroke="#90a8c2" stroke-width="1.2" x="1173" y="344" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1203" y="344" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1233" y="344" width="22" height="28" rx="1"/>
  <rect fill="#bcccea" stroke="#90a8c2" stroke-width="1.2" x="1263" y="344" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1293" y="344" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1173" y="384" width="22" height="28" rx="1"/>
  <rect fill="#bcccea" stroke="#90a8c2" stroke-width="1.2" x="1203" y="384" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1233" y="384" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1263" y="384" width="22" height="28" rx="1"/>
  <rect fill="#bcccea" stroke="#90a8c2" stroke-width="1.2" x="1293" y="384" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1173" y="424" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1203" y="424" width="22" height="28" rx="1"/>
  <rect fill="#bcccea" stroke="#90a8c2" stroke-width="1.2" x="1233" y="424" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1263" y="424" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1293" y="424" width="22" height="28" rx="1"/>
  <rect fill="#bcccea" stroke="#90a8c2" stroke-width="1.2" x="1173" y="464" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1203" y="464" width="22" height="28" rx="1"/>
  <rect fill="#bcccea" stroke="#90a8c2" stroke-width="1.2" x="1233" y="464" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1263" y="464" width="22" height="28" rx="1"/>
  <rect fill="#c4d4ec" stroke="#98b0c8" stroke-width="1.2" x="1293" y="464" width="22" height="28" rx="1"/>
  <rect fill="#d8e6f8" stroke="#a4bcda" stroke-width="2" x="460" y="140" width="28" height="340" rx="2"/>
  <rect fill="#ccdaf4" stroke="#9cb4d0" stroke-width="1.5" x="410" y="138" width="420" height="10" rx="2"/>
  <rect fill="#ccdaf4" stroke="#9cb4d0" stroke-width="1.5" x="380" y="138" width="52" height="10" rx="2"/>
  <rect fill="#c8d6f2" stroke="#98b0cc" stroke-width="1.5" x="368" y="130" width="28" height="22" rx="2"/>
  <rect fill="#d8e6f8" stroke="#a4bcda" stroke-width="1.5" x="448" y="148" width="16" height="10" rx="1"/>
  <line stroke="#b4c8e8" stroke-width="1.2" x1="456" y1="158" x2="456" y2="200" stroke-linecap="round"/>
  <path d="M450 200 Q456 210 462 200" stroke="#b4c8e8" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <line stroke="#b4c8e8" stroke-width="1" x1="474" y1="142" x2="414" y2="148" stroke-linecap="round"/>
  <line stroke="#b4c8e8" stroke-width="1" x1="474" y1="142" x2="830" y2="148" stroke-linecap="round"/>
  <circle cx="1320" cy="80" r="38" fill="none" stroke="#bcd0e8" stroke-width="1"/>
  <circle cx="1320" cy="80" r="28" fill="none" stroke="#bcd0e8" stroke-width="0.6"/>
  <line x1="1320" y1="42" x2="1320" y2="118" stroke="#bcd0e8" stroke-width="0.8"/>
  <line x1="1282" y1="80" x2="1358" y2="80" stroke="#bcd0e8" stroke-width="0.8"/>
  <line x1="1293" y1="53" x2="1347" y2="107" stroke="#c8daf0" stroke-width="0.5"/>
  <line x1="1347" y1="53" x2="1293" y2="107" stroke="#c8daf0" stroke-width="0.5"/>
  <polygon points="1320,43 1315,58 1320,55 1325,58" fill="#a8c0dc"/>
  <ellipse cx="70" cy="850" rx="56" ry="20" fill="#f0d870" stroke="#c8b040" stroke-width="1"/>
  <path d="M18 850 Q22 820 70 814 Q118 820 122 850Z" fill="#f0d870" stroke="#c8b040" stroke-width="1"/>
  <rect x="14" y="848" width="112" height="10" rx="3" fill="#e4cc60" stroke="#c8b040" stroke-width="1"/>
  <rect x="960" y="870" width="200" height="24" rx="3" fill="#d8e6f8" stroke="#a0b8d4" stroke-width="1"/>
  <line x1="984" y1="870" x2="984" y2="882" stroke="#a0b8d4" stroke-width="0.8"/>
  <line x1="1008" y1="870" x2="1008" y2="882" stroke="#a0b8d4" stroke-width="0.8"/>
  <line x1="1032" y1="870" x2="1032" y2="888" stroke="#a0b8d4" stroke-width="1"/>
  <line x1="1056" y1="870" x2="1056" y2="882" stroke="#a0b8d4" stroke-width="0.8"/>
  <line x1="1080" y1="870" x2="1080" y2="882" stroke="#a0b8d4" stroke-width="0.8"/>
  <line x1="1104" y1="870" x2="1104" y2="888" stroke="#a0b8d4" stroke-width="1"/>
  <line x1="1128" y1="870" x2="1128" y2="882" stroke="#a0b8d4" stroke-width="0.8"/>
  <line x1="1152" y1="870" x2="1152" y2="882" stroke="#a0b8d4" stroke-width="0.8"/>
</svg>`;

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]       = useState({ username: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(form);
      login(res.token, res.user, res.permissions);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
      background: '#eef5ff',
    }}>
      {/* SVG Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}
        dangerouslySetInnerHTML={{ __html: BG_SVG }}
      />

      {/* Frosted overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'rgba(238,245,255,0.55)',
        backdropFilter: 'blur(1px)',
      }} />

      {/* Login card */}
      <div style={{
        position: 'relative', zIndex: 2,
        width: '100%', maxWidth: 400,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(176,200,228,0.7)',
        borderRadius: 16,
        boxShadow: '0 8px 40px rgba(100,140,200,0.18)',
        padding: '36px 32px',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏗️</div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#1e3a5f', lineHeight: 1.35 }}>
            {t.appName}
          </h1>
          <p style={{ fontSize: 12, color: '#6b8aaa', marginTop: 5 }}>{t.loginSubtitle}</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(220,38,38,0.08)', border: '1px solid #dc2626',
            color: '#dc2626', borderRadius: 8, padding: '9px 12px',
            fontSize: 12, marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a8a', display: 'block', marginBottom: 5 }}>
              {t.username}
            </label>
            <input
              style={{
                width: '100%', background: '#f0f6ff',
                border: '1px solid #b8d0e8', borderRadius: 8,
                color: '#1e3a5f', padding: '9px 12px', fontSize: 13,
                boxSizing: 'border-box',
              }}
              type="text"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder={t.username}
              required autoFocus
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a8a', display: 'block', marginBottom: 5 }}>
              {t.password}
            </label>
            <input
              style={{
                width: '100%', background: '#f0f6ff',
                border: '1px solid #b8d0e8', borderRadius: 8,
                color: '#1e3a5f', padding: '9px 12px', fontSize: 13,
                boxSizing: 'border-box',
              }}
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={t.password}
              required
            />
          </div>
          <button
            type="submit"
            style={{
              width: '100%', padding: '11px',
              background: loading ? '#7ab0d8' : '#0ea5e9',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
            disabled={loading}
          >
            {loading ? t.loading : t.login}
          </button>
        </form>
      </div>
    </div>
  );
}