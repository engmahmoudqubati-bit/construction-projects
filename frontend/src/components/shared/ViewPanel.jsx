import { useState } from 'react';

export default function ViewPanel({ title, items, fields, onClose }) {
  const [page, setPage] = useState(0);
  if (!items || items.length === 0) return null;
  const item = items[Math.min(page, items.length - 1)];

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.45)',backdropFilter:'blur(4px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'var(--card)',borderRadius:16,boxShadow:'0 24px 60px rgba(0,0,0,0.18)',width:'100%',maxWidth:580,overflow:'hidden'}}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#6d28d9 0%,#7c3aed 100%)',padding:'18px 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.65)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>
              {title} › View
            </div>
            <div style={{fontSize:17,fontWeight:700,color:'#fff'}}>{fields(item)[0][1]}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {items.length > 1 && (
              <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.15)',borderRadius:8,padding:'4px 10px'}}>
                <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
                  style={{background:'none',border:'none',color:'#fff',cursor:page===0?'not-allowed':'pointer',opacity:page===0?0.35:1,display:'flex',alignItems:'center'}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span style={{color:'#fff',fontSize:12,fontWeight:500,minWidth:40,textAlign:'center'}}>{page+1} / {items.length}</span>
                <button onClick={()=>setPage(p=>Math.min(items.length-1,p+1))} disabled={page>=items.length-1}
                  style={{background:'none',border:'none',color:'#fff',cursor:page>=items.length-1?'not-allowed':'pointer',opacity:page>=items.length-1?0.35:1,display:'flex',alignItems:'center'}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            )}
            <button onClick={onClose}
              style={{background:'rgba(255,255,255,0.18)',border:'none',color:'#fff',borderRadius:8,width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{padding:'24px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 32px'}}>
          {fields(item).map(([label,value])=>(
            <div key={label} style={{marginBottom:18}}>
              <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'#9ca3af',marginBottom:6}}>{label}</div>
              <div style={{fontSize:14,color:'var(--text)'}}>{value||'—'}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{padding:'14px 24px',borderTop:'1px solid var(--border-light)',display:'flex',justifyContent:'flex-end',background:'var(--card2)'}}>
          <button onClick={onClose}
            style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 16px',fontSize:13,cursor:'pointer',fontFamily:'inherit',color:'var(--text)'}}>
            ✕ Close
          </button>
        </div>
      </div>
    </div>
  );
}