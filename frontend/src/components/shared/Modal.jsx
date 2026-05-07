import { useEffect } from 'react';

export default function Modal({
  open, onClose, title, parentTitle,
  size = 'md', children,
  onSave, saveLabel = 'Save',
  saving = false,
  footer,
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    function handler(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'F10' && onSave) { e.preventDefault(); onSave(); }
    }
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose, onSave]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size}`} onClick={e => e.stopPropagation()}>

        {/* Header — matches view window exactly */}
        <div className="modal-header">
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {parentTitle && (
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:500 }}>
                {parentTitle} › {title}
              </span>
            )}
            <span style={{ fontSize:17, fontWeight:700, color:'#fff', letterSpacing:'-0.01em' }}>
              {parentTitle ? title : title}
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        {/* Body */}
        <div className="modal-body">{children}</div>

        {/* Footer */}
        {onSave ? (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
              <span style={{ fontSize:12 }}>✕</span> Exit
            </button>
            <button className="btn btn-save" onClick={onSave} disabled={saving}>
              {saving
                ? <><span className="btn-spinner" /> Saving...</>
                : <><span>✓</span> {saveLabel} <kbd>F10</kbd></>
              }
            </button>
          </div>
        ) : footer ? (
          <div className="modal-footer">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}