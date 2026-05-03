import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import KPICards from '../components/dashboard/KPICards';
import { InstallationChart, DeliveryChart, InspectionPieChart } from '../components/dashboard/ProgressChart';
import t from '../lang';

export default function Dashboard() {
  const { user, permissions } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('all');

  const [kpis,         setKpis]         = useState(null);
  const [installData,  setInstallData]  = useState([]);
  const [deliveryData, setDeliveryData] = useState([]);
  const [inspData,     setInspData]     = useState(null);
  const [loading,      setLoading]      = useState(false);

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {});
  }, []);

  const loadDashboard = useCallback(async (pid) => {
    setLoading(true);
    try {
      const [k, inst, del] = await Promise.all([
        api.getDashboardKpis(pid),
        api.getInstallationProgress(pid),
        api.getDeliveryProgress(pid),
      ]);
      setKpis(k);
      setInstallData(inst);
      setDeliveryData(del);
      setInspData(k); // pass/fail/pending counts live in kpis
    } catch {
      // silently keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(selectedProject);
  }, [selectedProject, loadDashboard]);

  const projectLabel = (p) =>
    [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  return (
    <div>
      {/* Project filter */}
      <div className="project-selector">
        <label>{t.selectProject}:</label>
        <select
          className="form-control"
          value={selectedProject}
          onChange={e => setSelectedProject(e.target.value)}
        >
          <option value="all">{t.allProjects}</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{projectLabel(p)}</option>
          ))}
        </select>
        {loading && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t.loading}</span>}
      </div>

      {/* KPI Cards */}
      <KPICards data={kpis} />

      {/* Charts */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">📦 {t.installationByItem}</span>
          </div>
          <div className="card-body">
            <InstallationChart data={installData} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">🚚 {t.deliveryByItem}</span>
          </div>
          <div className="card-body">
            <DeliveryChart data={deliveryData} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">🔍 {t.inspectionResults}</span>
          </div>
          <div className="card-body">
            <InspectionPieChart data={inspData} />
          </div>
        </div>
      </div>
    </div>
  );
}
