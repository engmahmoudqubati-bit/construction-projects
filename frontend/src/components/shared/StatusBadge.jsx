const dots = {
  active: '●', inactive: '○', pass: '●', fail: '●', pending: '◐',
  completed: '●', on_hold: '◑', cancelled: '●',
};

export default function StatusBadge({ value }) {
  const key = String(value).toLowerCase().replace(' ', '_');
  const dot = dots[key] || '●';
  return (
    <span className={`badge badge-${key}`}>
      {dot} {value}
    </span>
  );
}
