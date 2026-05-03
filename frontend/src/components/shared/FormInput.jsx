export default function FormInput({ label, error, required, children, ...props }) {
  if (children) {
    return (
      <div className="form-group">
        {label && <label className="form-label">{label}{required && ' *'}</label>}
        {children}
        {error && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</span>}
      </div>
    );
  }

  const { type = 'text', ...rest } = props;
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}{required && ' *'}</label>}
      <input type={type} className="form-control" {...rest} />
      {error && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}
