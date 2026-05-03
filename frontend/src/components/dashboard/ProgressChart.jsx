import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import t from '../../lang';

const COLORS = { pass: '#22c55e', fail: '#ef4444', pending: '#f59e0b' };
const BAR_COLORS = { installed: '#38bdf8', planned: '#334155', delivered: '#a78bfa' };

function truncate(str, n = 14) {
  return str && str.length > n ? str.slice(0, n) + '…' : str;
}

export function InstallationChart({ data }) {
  if (!data?.length) return <div className="empty-state"><p>{t.noData}</p></div>;
  const chartData = data.map(d => ({
    name: truncate(d.item_name),
    [t.installed]: parseFloat(d.installed_qty),
    [t.planned]:   parseFloat(d.planned_qty),
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} angle={-35} textAnchor="end" />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey={t.planned}   fill={BAR_COLORS.planned}   radius={[3,3,0,0]} />
        <Bar dataKey={t.installed} fill={BAR_COLORS.installed} radius={[3,3,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DeliveryChart({ data }) {
  if (!data?.length) return <div className="empty-state"><p>{t.noData}</p></div>;
  const chartData = data.map(d => ({
    name: truncate(d.item_name),
    [t.delivered]: parseFloat(d.delivered_qty),
    [t.planned]:   parseFloat(d.planned_qty),
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} angle={-35} textAnchor="end" />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey={t.planned}   fill={BAR_COLORS.planned}   radius={[3,3,0,0]} />
        <Bar dataKey={t.delivered} fill={BAR_COLORS.delivered} radius={[3,3,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function InspectionPieChart({ data: kpis }) {
  if (!kpis) return null;
  const pieData = [
    { name: t.pass,    value: kpis.pass_count,    color: COLORS.pass    },
    { name: t.fail,    value: kpis.fail_count,    color: COLORS.fail    },
    { name: t.pending, value: kpis.pending_count, color: COLORS.pending },
  ].filter(d => d.value > 0);

  if (!pieData.length) return <div className="empty-state"><p>{t.noData}</p></div>;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%" cy="50%"
          outerRadius={100}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {pieData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
