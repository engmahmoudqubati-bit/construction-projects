import { useState } from 'react';

export default function RefreshButton({ onRefresh, size = 'sm' }) {
  const [spinning, setSpinning] = useState(false);

  async function handleClick() {
    if (spinning) return;
    setSpinning(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setSpinning(false), 500);
    }
  }

  return (
    <button
      className={`btn btn-secondary btn-${size}`}
      onClick={handleClick}
      title="Refresh"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
    >
      <span style={{
        display: 'inline-block',
        fontSize: 13,
        animation: spinning ? 'spin 0.6s linear infinite' : 'none',
      }}>↻</span>
      {size !== 'sm' && <span>Refresh</span>}
    </button>
  );
}