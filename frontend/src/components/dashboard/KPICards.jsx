import t from '../../lang';

function KPI({ label, value, sub, color, icon }) {
  return (
    <div className={`kpi-card ${color || ''}`}>
      <span className="kpi-icon">{icon}</span>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export default function KPICards({ data }) {
  if (!data) return null;
  const passRate = data.pass_count + data.fail_count + data.pending_count > 0
    ? ((data.pass_count / (data.pass_count + data.fail_count + data.pending_count)) * 100).toFixed(1)
    : 0;

  return (
    <div className="kpi-grid">
      <KPI
        label={t.totalProjects}
        value={data.project_count}
        icon="🏗️"
        color=""
      />
      <KPI
        label={t.installationProgress}
        value={`${data.installation_pct}%`}
        sub={`${data.installed_qty} / ${data.planned_qty} units`}
        icon="🔧"
        color={data.installation_pct >= 80 ? 'success' : data.installation_pct >= 40 ? '' : 'warning'}
      />
      <KPI
        label={t.deliveryProgress}
        value={`${data.delivery_pct}%`}
        sub={`${data.delivered_qty} / ${data.planned_qty} units`}
        icon="🚚"
        color={data.delivery_pct >= 80 ? 'success' : data.delivery_pct >= 40 ? '' : 'warning'}
      />
      <KPI
        label={t.passRate}
        value={`${passRate}%`}
        sub={`${data.pass_count} pass · ${data.fail_count} fail · ${data.pending_count} pending`}
        icon="✅"
        color={passRate >= 80 ? 'success' : passRate >= 50 ? '' : 'danger'}
      />
    </div>
  );
}
