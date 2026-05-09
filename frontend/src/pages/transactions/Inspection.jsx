export default function Inspection() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:20 }}>
      <div style={{ fontSize:64 }}>🔍</div>
      <h2 style={{ fontSize:24, fontWeight:700, color:'var(--text)', margin:0 }}>Inspection</h2>
      <div style={{ display:'flex', alignItems:'center', gap:10, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:12, padding:'12px 24px' }}>
        <span style={{ fontSize:20 }}>🚧</span>
        <span style={{ fontSize:15, fontWeight:600, color:'#ea580c' }}>Under Progress.... Coming Soon</span>
        <span style={{ fontSize:20 }}>🚧</span>
      </div>
      <p style={{ fontSize:13, color:'#9ca3af', margin:0 }}>This module is currently being developed. Stay tuned!</p>
    </div>
  );
}