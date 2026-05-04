import { useEffect } from 'react';

// parentTitle → "Parent Form" — appears before > in breadcrumb
// onSave → if provided, F10 triggers it and footer shows Save button
export default function Modal({
  open, onClose, title, parentTitle,
  size = 'md', children,
  onSave, saveLabel = 'Save',
  saving = false,
  footer,        // fallback custom footer
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

        {/* Breadcrumb header */}
        <div className="modal-header">
          <div className="modal-breadcrumb">
            {parentTitle && (
              <>
                <span className="modal-bc-parent">{parentTitle}</span>
                <span className="modal-bc-sep">›</span>
              </>
            )}
            <span className="modal-bc-current">{title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="modal-close-btn" onClick={onClose} title="Close (Esc)">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body">{children}</div>

        {/* Footer */}
        {onSave ? (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
              <span style={{ fontSize: 12 }}>✕</span> Exit
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
