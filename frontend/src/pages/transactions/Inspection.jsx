export default function Inspection() {
  const styles = {
    page: {
      minHeight: 'calc(100vh - 120px)',
      background: 'linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)',
      padding: '18px',
      fontFamily: 'Inter, Segoe UI, Roboto, Arial, sans-serif',
      color: '#0f172a'
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      background: '#ffffff',
      border: '1px solid #dbeafe',
      borderRadius: 16,
      padding: '14px 18px',
      boxShadow: '0 8px 22px rgba(15, 23, 42, 0.06)',
      marginBottom: 16
    },
    titleWrap: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    },
    iconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 20,
      boxShadow: '0 10px 20px rgba(37, 99, 235, 0.25)'
    },
    title: {
      margin: 0,
      fontSize: 18,
      fontWeight: 800,
      letterSpacing: '-0.02em',
      color: '#0f172a'
    },
    subtitle: {
      margin: '3px 0 0',
      fontSize: 12,
      color: '#64748b',
      fontWeight: 500
    },
    statusPill: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      borderRadius: 999,
      background: '#eff6ff',
      border: '1px solid #bfdbfe',
      color: '#1d4ed8',
      fontSize: 12,
      fontWeight: 800,
      whiteSpace: 'nowrap'
    },
    hero: {
      background: '#ffffff',
      border: '1px solid #dbeafe',
      borderRadius: 18,
      boxShadow: '0 14px 34px rgba(15, 23, 42, 0.08)',
      overflow: 'hidden'
    },
    heroTop: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)',
      gap: 18,
      padding: 22,
      alignItems: 'center'
    },
    headline: {
      margin: 0,
      fontSize: 24,
      lineHeight: 1.25,
      fontWeight: 900,
      letterSpacing: '-0.03em',
      color: '#0f172a'
    },
    message: {
      margin: '10px 0 0',
      fontSize: 14,
      lineHeight: 1.7,
      color: '#475569',
      maxWidth: 720
    },
    progressCard: {
      background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
      border: '1px solid #bfdbfe',
      borderRadius: 16,
      padding: 18
    },
    progressHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
      color: '#1e3a8a',
      fontSize: 13,
      fontWeight: 800
    },
    progressTrack: {
      height: 10,
      background: '#dbeafe',
      borderRadius: 999,
      overflow: 'hidden'
    },
    progressFill: {
      height: '100%',
      width: '35%',
      background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
      borderRadius: 999
    },
    steps: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: 12,
      padding: '0 22px 22px'
    },
    step: {
      border: '1px solid #e2e8f0',
      background: '#f8fafc',
      borderRadius: 14,
      padding: 14
    },
    stepIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#eff6ff',
      color: '#1d4ed8',
      fontSize: 16,
      marginBottom: 10
    },
    stepTitle: {
      margin: 0,
      fontSize: 13,
      fontWeight: 800,
      color: '#0f172a'
    },
    stepText: {
      margin: '6px 0 0',
      fontSize: 12,
      lineHeight: 1.5,
      color: '#64748b'
    },
    footer: {
      borderTop: '1px solid #e2e8f0',
      padding: '12px 22px',
      background: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap'
    },
    note: {
      margin: 0,
      color: '#64748b',
      fontSize: 12,
      fontWeight: 500
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.titleWrap}>
          <div style={styles.iconBox}>🔍</div>
          <div>
            <h2 style={styles.title}>Inspection</h2>
            <p style={styles.subtitle}>Quality inspection workflow for project monitoring.</p>
          </div>
        </div>
        <div style={styles.statusPill}>🚧 Under Progress</div>
      </div>

      <div style={styles.hero}>
        <div style={styles.heroTop}>
          <div>
            <h1 style={styles.headline}>Inspection module is coming soon</h1>
            <p style={styles.message}>
              This screen is reserved for inspection tracking, site quality checks, observations,
              approvals and project completion control. The layout is ready and will follow the
              same professional design system used across Installation, Delivery and BOQ forms.
            </p>
          </div>

          <div style={styles.progressCard}>
            <div style={styles.progressHeader}>
              <span>Development Status</span>
              <span>In Progress</span>
            </div>
            <div style={styles.progressTrack}>
              <div style={styles.progressFill} />
            </div>
          </div>
        </div>

        <div style={styles.steps}>
          <div style={styles.step}>
            <div style={styles.stepIcon}>📋</div>
            <h3 style={styles.stepTitle}>Inspection Records</h3>
            <p style={styles.stepText}>Daily site inspection entries with project, area, item and status tracking.</p>
          </div>
          <div style={styles.step}>
            <div style={styles.stepIcon}>✅</div>
            <h3 style={styles.stepTitle}>Approval Flow</h3>
            <p style={styles.stepText}>Draft, saved and approved statuses aligned with your transaction workflow.</p>
          </div>
          <div style={styles.step}>
            <div style={styles.stepIcon}>📊</div>
            <h3 style={styles.stepTitle}>Progress Control</h3>
            <p style={styles.stepText}>Inspection results will support monitoring and completion visibility.</p>
          </div>
        </div>

        <div style={styles.footer}>
          <p style={styles.note}>Coming Soon — this module is currently being developed.</p>
          <p style={styles.note}>Design system: consistent blue/gray theme, compact layout and clean cards.</p>
        </div>
      </div>
    </div>
  );
}
