import { useState } from 'react';

const TABS = [
  { key: 'settings',      label: '⚙️ Settings',      icon: '⚙️' },
  { key: 'workflows',     label: '🔄 Workflows',     icon: '🔄' },
  { key: 'notifications', label: '🔔 Notifications', icon: '🔔' },
  { key: 'security',      label: '🔒 Security',      icon: '🔒' },
];

function ComingSoon({ icon, title }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      minHeight:'40vh', gap:16, padding:40 }}>
      <div style={{ fontSize:56 }}>{icon}</div>
      <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)', margin:0 }}>{title}</h2>
      <div style={{ display:'flex', alignItems:'center', gap:10, background:'#fff7ed',
        border:'1px solid #fed7aa', borderRadius:12, padding:'12px 24px' }}>
        <span style={{ fontSize:20 }}>🚧</span>
        <span style={{ fontSize:15, fontWeight:600, color:'#ea580c' }}>
          Development Under Progress....
        </span>
        <span style={{ fontSize:20 }}>🚧</span>
      </div>
      <p style={{ fontSize:13, color:'#9ca3af', margin:0 }}>
        This module is currently being developed. Stay tuned!
      </p>
    </div>
  );
}

export default function SystemSetup() {
  const [activeTab, setActiveTab] = useState('settings');

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24 }}>
        <div style={{ width:48, height:48, borderRadius:14, background:'#eff6ff',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:24 }}>🛠️</span>
        </div>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text)', margin:0 }}>System Setup</h1>
          <p style={{ fontSize:12, color:'#9ca3af', margin:'4px 0 0 0' }}>
            Configure system settings, workflows, notifications and security policies
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, marginBottom:24, borderBottom:'2px solid #eff6ff' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding:'10px 28px', fontSize:13, fontWeight:600, cursor:'pointer',
            background:'none', border:'none', fontFamily:'inherit',
            color: activeTab===tab.key ? '#2563eb' : '#6b7280',
            borderBottom: activeTab===tab.key ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom:-2, transition:'all 0.15s', whiteSpace:'nowrap',
          }}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'settings'      && <ComingSoon icon="⚙️" title="Settings" />}
      {activeTab === 'workflows'     && <ComingSoon icon="🔄" title="Workflows" />}
      {activeTab === 'notifications' && <ComingSoon icon="🔔" title="Notifications" />}
      {activeTab === 'security'      && <ComingSoon icon="🔒" title="Security" />}
    </div>
  );
}