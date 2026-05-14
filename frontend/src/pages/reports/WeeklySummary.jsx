import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';

const fmt2 = v => (parseFloat(v) || 0).toFixed(2);
const fmt0 = v => (parseFloat(v) || 0).toFixed(0);
const pct = (qty, planned) => (parseFloat(planned) || 0) > 0 ? ((parseFloat(qty) || 0) / (parseFloat(planned) || 0)) * 100 : 0;
const pctChange = (current, previous) => {
  const c = parseFloat(current) || 0;
  const p = parseFloat(previous) || 0;
  if (p === 0) return c > 0 ? 100 : 0;
  return ((c - p) / p) * 100;
};
const changeText = value => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
const getStoredUserName = () => {
  try {
    const user = JSON.parse(localStorage.getItem('cp_user') || 'null');
    return user?.full_name_en || user?.full_name || user?.full_name_ar || user?.username || 'Unknown User';
  } catch {
    return 'Unknown User';
  }
};

// ── Week calculation helpers ────────────────────────────────────────────────
// A week runs Sat (day 6) → Thu (day 4)
// Given any date string, find the Saturday that starts its week
function getWeekSaturday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d); // local date — no UTC shift
  const day = date.getDay(); // 0=Sun,1=Mon,...,6=Sat
  // days back to Saturday: Sun→1, Mon→2, Tue→3, Wed→4, Thu→5, Fri→6, Sat→0
  const offset = day === 6 ? 0 : day + 1;
  date.setDate(date.getDate() - offset);
  return date;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(date) {
  // Use local date parts to avoid UTC timezone shift (e.g. Gulf UTC+3)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(dateStr) {
  if (!dateStr) return '';
  // Parse as local date to avoid UTC shift
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}


function parseManualDateDMY(value) {
  const text = String(value || '').trim();
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return toISO(date);
}

function findWeekByDate(weeks, isoDate) {
  if (!isoDate) return null;
  return weeks.find(w => isoDate >= w.sat && isoDate <= w.thu) || null;
}

// Generate all SAT→THU weeks from the first transaction date to the last transaction date.
// The weekly filter must be driven by Delivery + Installation activity, not by today's date.
function generateWeeks(firstDateStr, lastDateStr) {
  if (!firstDateStr) return [];
  let sat = getWeekSaturday(firstDateStr);
  const last = lastDateStr ? new Date(...lastDateStr.split('-').map((v, i) => i === 1 ? Number(v) - 1 : Number(v))) : new Date();
  const lastWeekSat = getWeekSaturday(toISO(last));
  const weeks = [];
  let wn = 1;
  while (sat <= lastWeekSat) {
    const thu = addDays(sat, 5); // Sat+5 = Thu
    weeks.push({
      weekNum: wn++,
      sat: toISO(sat),
      thu: toISO(thu),
      label: `Week ${wn - 1}`,
    });
    sat = addDays(sat, 7);
  }
  return weeks;
}

function getActivityDateRange(deliveryMatrix, installationMap) {
  const dates = [];

  (Array.isArray(deliveryMatrix) ? deliveryMatrix : []).forEach(r => {
    const txDate = String(r.transaction_date || '').slice(0, 10);
    const qty = parseFloat(r.qty_delivered) || 0;
    if (txDate && qty > 0) dates.push(txDate);
  });

  const installationTxs = Array.isArray(installationMap?.txs) ? installationMap.txs : [];
  installationTxs.forEach(r => {
    const txDate = String(r.transaction_date || '').slice(0, 10);
    const qty = parseFloat(r.qty_installed) || 0;
    if (txDate && qty > 0) dates.push(txDate);
  });

  if (!dates.length) return { minDate: null, maxDate: null };
  dates.sort();
  return { minDate: dates[0], maxDate: dates[dates.length - 1] };
}

// ── Main Component ────────────────────────────────────────────────────────────

function exportRowsToXlsx(filename, headers, rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeHeaders = Array.isArray(headers) ? headers : [];

  if (window.XLSX && window.XLSX.utils) {
    const aoa = [safeHeaders, ...safeRows];
    const ws = window.XLSX.utils.aoa_to_sheet(aoa);

    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    ws['!cols'] = safeHeaders.map((header, colIndex) => {
      const maxLen = Math.max(
        String(header ?? '').length,
        ...safeRows.map((row) => String(row?.[colIndex] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 2, 12), 42) };
    });

    safeHeaders.forEach((_, colIndex) => {
      const cellAddress = window.XLSX.utils.encode_cell({ r: 0, c: colIndex });
      if (!ws[cellAddress]) return;
      ws[cellAddress].s = {
        font: { bold: true },
        alignment: { horizontal: 'center', vertical: 'center' },
      };
    });

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Weekly Summary');
    window.XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
    return;
  }

  const csv = '\ufeff' + [safeHeaders, ...safeRows]
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.replace(/\.xlsx$/i, '.csv');
  a.click();
  URL.revokeObjectURL(a.href);
}


export default function WeeklySummary() {
  const toast = useToast();

  const [projects,    setProjects]    = useState([]);
  const [projectId,   setProjectId]   = useState('');
  const [weeks,       setWeeks]       = useState([]);
  const [weekNum,     setWeekNum]     = useState('');
  const [weekInput,   setWeekInput]   = useState(''); // typed week number
  const [selectedYear,  setSelectedYear]  = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [reportData,  setReportData]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [firstDate,   setFirstDate]   = useState(null);
  const [lastDate,    setLastDate]    = useState(null);
  const [search,      setSearch]      = useState('');
  const [classificationFilter, setClassificationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => { api.getProjects().then(setProjects).catch(() => {}); }, []);

  // When project changes, generate week options from actual Delivery + Installation activity.
  // Example: if the project has delivery on 21 May, the May week ending 21 May will appear
  // even when the current real date is earlier than that.
  const loadWeeks = useCallback(async (pid) => {
    if (!pid) { setWeeks([]); setFirstDate(null); setLastDate(null); return; }
    try {
      const dummy = new Date().toISOString().slice(0, 10);
      const [data, deliveryMatrix, installationMap] = await Promise.all([
        api.getWeeklyReport(pid, dummy, dummy).catch(() => ({})),
        api.getDeliveryMatrix ? api.getDeliveryMatrix(pid).catch(() => []) : Promise.resolve([]),
        api.getInstallationMap ? api.getInstallationMap(pid).catch(() => null) : Promise.resolve(null),
      ]);

      const { minDate, maxDate } = getActivityDateRange(deliveryMatrix, installationMap);
      const startDate = minDate || data.firstDeliveryDate || null;
      const endDate = maxDate || startDate;

      if (startDate) {
        setFirstDate(startDate);
        setLastDate(endDate);
        setWeeks(generateWeeks(startDate, endDate));
      } else {
        setWeeks([]);
        setFirstDate(null);
        setLastDate(null);
      }
    } catch {
      setWeeks([]);
      setFirstDate(null);
      setLastDate(null);
    }
  }, []);

  useEffect(() => { loadWeeks(projectId); setWeekNum(''); setWeekInput(''); setReportData(null); setSelectedYear(''); setSelectedMonth(''); setClassificationFilter(''); setSearch(''); setPage(1); }, [projectId, loadWeeks]);

  // All available years from weeks
  const years = useMemo(() => [...new Set(weeks.map(w => w.sat.slice(0, 4)))].sort(), [weeks]);

  // Filtered weeks by year+month
  const filteredWeeks = useMemo(() => {
    let ws = weeks;
    if (selectedYear)  ws = ws.filter(w => w.sat.startsWith(selectedYear) || w.thu.startsWith(selectedYear));
    if (selectedMonth) ws = ws.filter(w => w.sat.slice(0, 7) === `${selectedYear}-${selectedMonth}` || w.thu.slice(0, 7) === `${selectedYear}-${selectedMonth}`);
    return ws;
  }, [weeks, selectedYear, selectedMonth]);

  // Months available given selected year
  const months = useMemo(() => {
    if (!selectedYear) return [];
    const ms = new Set();
    weeks.forEach(w => {
      if (w.sat.startsWith(selectedYear)) ms.add(w.sat.slice(5, 7));
      if (w.thu.startsWith(selectedYear)) ms.add(w.thu.slice(5, 7));
    });
    return [...ms].sort();
  }, [weeks, selectedYear]);

  const selectedWeek = useMemo(() => weeks.find(w => w.weekNum === parseInt(weekNum)), [weeks, weekNum]);

  async function loadReport() {
    if (!projectId || !selectedWeek) return;
    setLoading(true);
    try {
      const [data, deliveryMatrix] = await Promise.all([
        api.getWeeklyReport(projectId, selectedWeek.sat, selectedWeek.thu),
        api.getDeliveryMatrix ? api.getDeliveryMatrix(projectId).catch(() => []) : Promise.resolve([]),
      ]);

      // Correct delivery cumulative value client-side from the delivery matrix.
      // This guarantees Week 2, Week 3, etc. show the SUM from first confirmed delivery
      // until the selected week end date, not only the selected week.
      const deliveredUntilWeekEnd = {};
      (Array.isArray(deliveryMatrix) ? deliveryMatrix : []).forEach(d => {
        if (d.tx_status !== 'confirmed') return;
        const dDate = String(d.transaction_date || '').slice(0, 10);
        if (dDate && dDate <= selectedWeek.thu) {
          const key = String(d.item_id);
          deliveredUntilWeekEnd[key] = (deliveredUntilWeekEnd[key] || 0) + (parseFloat(d.qty_delivered) || 0);
        }
      });

      const correctedRows = (data.rows || []).map(r => ({
        ...r,
        delivered_to_date: deliveredUntilWeekEnd[String(r.item_id)] ?? r.delivered_to_date ?? 0,
      }));

      setReportData({ ...data, rows: correctedRows });
    } catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (selectedWeek) loadReport(); }, [selectedWeek]);

  function handleWeekInput(val) {
    setWeekInput(val);
    const isoDate = parseManualDateDMY(val);
    if (isoDate) {
      const matchedWeek = findWeekByDate(weeks, isoDate);
      if (matchedWeek) {
        setSelectedYear(matchedWeek.sat.slice(0, 4));
        setSelectedMonth(matchedWeek.sat.slice(5, 7));
        setWeekNum(String(matchedWeek.weekNum));
        setPage(1);
      }
      return;
    }
    const n = parseInt(val);
    if (!isNaN(n) && weeks.find(w => w.weekNum === n)) {
      setWeekNum(String(n));
      setPage(1);
    }
  }

  function csvValue(value) {
    const text = String(value ?? '').replace(/"/g, '""');
    return /[",\n]/.test(text) ? `"${text}"` : text;
  }

  // Build report rows using the final displayed values.
  // Delivery is recalculated from the delivery matrix when available so Week 2+ is cumulative
  // from project start until the selected week end date.
  function normalizedRow(row) {
    const planned = parseFloat(row.planned_qty) || 0;
    const delToDate = parseFloat(row.delivered_to_date) || 0;
    const instThisW = parseFloat(row.installed_this_week) || 0;
    const instLastW = parseFloat(row.installed_last_week) || 0;
    const instToDate = parseFloat(row.installed_to_date) || 0;
    return {
      planned, delToDate, instThisW, instLastW, instToDate,
      delPct: pct(delToDate, planned),
      instThisPct: pct(instThisW, planned),
      instLastPct: pct(instLastW, planned),
      instToDatePct: pct(instToDate, planned),
    };
  }

  function exportCSV() {
    const rowsToExport = filteredRows?.length ? filteredRows : reportData?.rows || [];
    if (!rowsToExport.length) return;

    const headers = ['Classification','Item Code','Item Name','Unit','Planned Qty',
      'Delivered Until Week End','Delivery % from Planning',
      'Installed This Week','Installed This Week % from Planning',
      'Last Week % from Planning',
      'Installed Until Week End','Installed Until Week End % from Planning'];

    const tableRows = rowsToExport.map(r => {
      const n = normalizedRow(r);
      const cls = [r.parent_classification_name, r.classification_name].filter(Boolean).join(' › ');
      return [cls, r.item_code, r.item_name, r.unit_of_measure || '',
        fmt2(n.planned), fmt2(n.delToDate), `${n.delPct.toFixed(1)}%`,
        fmt2(n.instThisW), `${n.instThisPct.toFixed(1)}%`,
        `${n.instLastPct.toFixed(1)}%`, fmt2(n.instToDate), `${n.instToDatePct.toFixed(1)}%`];
    });

    const safe = value => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const colWidths = headers.map((h, i) => Math.min(Math.max(
      String(h).length,
      ...tableRows.map(r => String(r[i] ?? '').length)
    ) + 4, 42));

    const excelCell = (value, styleId = 'Default') => {
      const isNumber = /^-?\d+(\.\d+)?%?$/.test(String(value ?? '').replace(/,/g, ''));
      if (isNumber && !String(value).includes('%')) {
        return `<Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${String(value).replace(/,/g, '')}</Data></Cell>`;
      }
      return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${safe(value)}</Data></Cell>`;
    };

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default"><Alignment ss:Vertical="Center"/><Font ss:FontName="Segoe UI" ss:Size="10"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dbe7f5"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dbe7f5"/></Borders></Style>
  <Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0f2e5f"/><Interior ss:Color="#eaf2ff" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#bcd1ee"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#bcd1ee"/></Borders></Style>
  <Style ss:ID="Text"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:FontName="Segoe UI" ss:Size="10"/></Style>
  <Style ss:ID="Number"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Font ss:FontName="Segoe UI" ss:Size="10"/></Style>
 </Styles>
 <Worksheet ss:Name="Weekly Summary">
  <Table>${colWidths.map(w => `<Column ss:AutoFitWidth="1" ss:Width="${Math.max(80, w * 7)}"/>`).join('')}
   <Row ss:Height="24">${headers.map(h => excelCell(h, 'Header')).join('')}</Row>
   ${tableRows.map(r => `<Row ss:Height="22">${r.map((c, i) => excelCell(c, i >= 4 ? 'Number' : 'Text')).join('')}</Row>`).join('')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
    <FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

    const blob = new Blob(['\ufeff', xml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly_summary_W${weekNum || 'selected'}_${projectId || 'project'}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printPDF() {
    const rowsToPrint = filteredRows?.length ? filteredRows : reportData?.rows || [];
    if (!rowsToPrint.length) return;
    const projectName = selectedProject ? projectLabel(selectedProject) : '';
    const weekText = selectedWeek ? `Week ${selectedWeek.weekNum} — ${formatDisplay(selectedWeek.sat)} to ${formatDisplay(selectedWeek.thu)}` : '';
    const filterText = [
      projectName && `Project: ${projectName}`,
      weekText,
      selectedYear && `Year: ${selectedYear}`,
      selectedMonth && `Month: ${monthName(selectedMonth)}`,
      classificationFilter && `Classification: ${classificationFilter}`,
      search && `Search: ${search}`,
    ].filter(Boolean);

    const groups = rowsToPrint.reduce((acc, row) => {
      const key = row.parent_classification_name
        ? `${row.parent_classification_name} › ${row.classification_name || ''}`
        : row.classification_name || 'Uncategorized';
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});

    const safe = value => String(value ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
    const totalsPrint = rowsToPrint.reduce((acc, r) => {
      const n = normalizedRow(r);
      acc.planned += n.planned;
      acc.delToDate += n.delToDate;
      acc.instThisW += n.instThisW;
      acc.instLastW += n.instLastW;
      acc.instToDate += n.instToDate;
      return acc;
    }, { planned:0, delToDate:0, instThisW:0, instLastW:0, instToDate:0 });
    const printDeliveryPct = pct(totalsPrint.delToDate, totalsPrint.planned);
    const printThisWeekPct = pct(totalsPrint.instThisW, totalsPrint.planned);
    const printLastWeekPct = pct(totalsPrint.instLastW, totalsPrint.planned);
    const printInstallPct = pct(totalsPrint.instToDate, totalsPrint.planned);
    const printWeekChangePct = pctChange(totalsPrint.instThisW, totalsPrint.instLastW);
    const printedBy = getStoredUserName();
    const printedAt = new Date().toLocaleString('en-GB', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const bodyRows = Object.entries(groups).map(([group, items]) => {
      const groupRows = items.map(r => {
        const n = normalizedRow(r);
        return `<tr>
          <td>${safe(r.item_code)}</td>
          <td>${safe(r.item_name)}</td>
          <td>${safe(r.unit_of_measure || '')}</td>
          <td class="num">${fmt2(n.planned)}</td>
          <td class="num del">${fmt2(n.delToDate)}</td>
          <td class="num del">${n.delPct.toFixed(1)}%</td>
          <td class="num ins">${fmt2(n.instThisW)}</td>
          <td class="num ins">${n.instThisPct.toFixed(1)}%</td>
          <td class="num ins">${n.instLastPct.toFixed(1)}%</td>
          <td class="num ins">${fmt2(n.instToDate)}</td>
          <td class="num ins">${n.instToDatePct.toFixed(1)}%</td>
        </tr>`;
      }).join('');
      return `<tr class="group"><td colspan="11">${safe(group)}</td></tr>${groupRows}`;
    }).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <title>Weekly Summary Report</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Inter, Segoe UI, Arial, sans-serif; color:#0f172a; margin:0; }
        .header { border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 10px; }
        .report-title { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
        h1 { font-size: 18px; margin:0 0 4px; }
        .print-meta { text-align:right; font-size:10px; color:#475569; line-height:1.55; white-space:nowrap; }
        .filters { display:flex; flex-wrap:wrap; gap:6px; font-size:11px; color:#334155; margin-top:7px; }
        .chip { background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:4px 7px; }
        .kpis { display:grid; grid-template-columns: repeat(7, 1fr); gap:6px; margin: 8px 0 10px; }
        .kpi { border:1px solid #dbe7f5; border-radius:8px; padding:6px 8px; background:#f8fbff; }
        .kpi .label { font-size:8px; text-transform:uppercase; letter-spacing:.05em; color:#64748b; font-weight:800; }
        .kpi .value { margin-top:3px; font-size:13px; font-weight:900; color:#0f2e5f; }
        table { width:100%; border-collapse:collapse; font-size:9.5px; table-layout:fixed; }
        th { background:#eaf2ff; color:#0f2e5f; text-transform:uppercase; letter-spacing:.03em; border:1px solid #cbdcf6; padding:6px; vertical-align:middle; }
        td { border:1px solid #e2e8f0; padding:5px 6px; vertical-align:middle; word-break:break-word; }
        .num { text-align:right; white-space:nowrap; }
        .del { background:#f8fbff; }
        .ins { background:#fbfffc; }
        .group td { background:#f1f6ff; color:#1d4ed8; font-weight:800; }
        tfoot td { background:#eaf2ff; font-weight:800; }
      </style></head><body>
        <div class="header">
          <div class="report-title">
            <div>
              <h1>Weekly Summary Report</h1>
              <div style="font-size:11px;color:#64748b;font-weight:700;">Project completion weekly delivery and installation summary</div>
            </div>
            <div class="print-meta">
              <div><b>Printed Date:</b> ${safe(printedAt)}</div>
              <div><b>Printed By:</b> ${safe(printedBy)}</div>
            </div>
          </div>
          <div class="filters">${filterText.map(f => `<span class="chip">${safe(f)}</span>`).join('')}</div>
        </div>
        <div class="kpis">
          <div class="kpi"><div class="label">Planned Qty</div><div class="value">${fmt2(totalsPrint.planned)}</div></div>
          <div class="kpi"><div class="label">Delivered Until Week End</div><div class="value">${fmt2(totalsPrint.delToDate)}</div></div>
          <div class="kpi"><div class="label">Delivery % of Planning</div><div class="value">${printDeliveryPct.toFixed(1)}%</div></div>
          <div class="kpi"><div class="label">Installed This Week</div><div class="value">${fmt2(totalsPrint.instThisW)} • ${printThisWeekPct.toFixed(1)}%</div></div>
          <div class="kpi"><div class="label">Installed Last Week</div><div class="value">${printLastWeekPct.toFixed(1)}%</div></div>
          <div class="kpi"><div class="label">Installation % of Planning</div><div class="value">${printInstallPct.toFixed(1)}%</div></div>
          <div class="kpi"><div class="label">Installation Change vs Last Week</div><div class="value">${changeText(printWeekChangePct)}</div></div>
        </div>
        <table>
          <thead><tr><th>Item Code</th><th>Item Name</th><th>Unit</th><th>Planned</th><th>Delivery Until Week End</th><th>Delivery %</th><th>Installed This Week</th><th>This Week %</th><th>Last Week %</th><th>Installed Until Week End</th><th>Until Week End %</th></tr></thead>
          <tbody>${bodyRows}</tbody>
          <tfoot><tr><td colspan="3">TOTAL — ${rowsToPrint.length} items</td><td class="num">${fmt2(totalsPrint.planned)}</td><td class="num">${fmt2(totalsPrint.delToDate)}</td><td class="num">${printDeliveryPct.toFixed(1)}%</td><td class="num">${fmt2(totalsPrint.instThisW)}</td><td class="num">${printThisWeekPct.toFixed(1)}%</td><td class="num">${printLastWeekPct.toFixed(1)}%</td><td class="num">${fmt2(totalsPrint.instToDate)}</td><td class="num">${printInstallPct.toFixed(1)}%</td></tr></tfoot>
        </table>
      </body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return toast('Unable to prepare print view.', 'error');
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  }

  const projectLabel = p => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');
  const monthName = m => new Date(`2000-${m}-01`).toLocaleDateString('en-GB', { month: 'long' });

  // Group rows by classification (with search filter)
  const classifications = useMemo(() => {
    if (!reportData?.rows) return [];
    return [...new Set(reportData.rows.map(r => (
      r.parent_classification_name
        ? `${r.parent_classification_name} › ${r.classification_name || ''}`
        : r.classification_name || 'Uncategorized'
    )))].sort();
  }, [reportData]);

  const grouped = useMemo(() => {
    if (!reportData?.rows) return {};
    let rows = reportData.rows;
    if (classificationFilter) {
      rows = rows.filter(r => {
        const cls = r.parent_classification_name
          ? `${r.parent_classification_name} › ${r.classification_name || ''}`
          : r.classification_name || 'Uncategorized';
        return cls === classificationFilter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        (r.item_name||'').toLowerCase().includes(q) ||
        (r.item_code||'').toLowerCase().includes(q) ||
        (r.unit_of_measure||'').toLowerCase().includes(q) ||
        (r.classification_name||'').toLowerCase().includes(q) ||
        (r.parent_classification_name||'').toLowerCase().includes(q)
      );
    }
    return rows.reduce((acc, row) => {
      const key = row.parent_classification_name
        ? `${row.parent_classification_name} › ${row.classification_name || ''}`
        : row.classification_name || 'Uncategorized';
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});
  }, [reportData, search, classificationFilter]);

  // Summary totals (from filtered rows)
  const filteredRows = useMemo(() => Object.values(grouped).flat(), [grouped]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

  const groupedForPage = useMemo(() => pagedRows.reduce((acc, row) => {
    const key = row.parent_classification_name
      ? `${row.parent_classification_name} › ${row.classification_name || ''}`
      : row.classification_name || 'Uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {}), [pagedRows]);

  useEffect(() => { setPage(1); }, [search, classificationFilter, weekNum, projectId, rowsPerPage]);

  const totals = useMemo(() => {
    if (!reportData?.rows) return null;
    return filteredRows.reduce((acc, r) => ({
      planned:    acc.planned    + (parseFloat(r.planned_qty) || 0),
      delToDate:  acc.delToDate  + (parseFloat(r.delivered_to_date) || 0),
      instThisW:  acc.instThisW  + (parseFloat(r.installed_this_week) || 0),
      instLastW:  acc.instLastW  + (parseFloat(r.installed_last_week) || 0),
      instToDate: acc.instToDate + (parseFloat(r.installed_to_date) || 0),
    }), { planned:0, delToDate:0, instThisW:0, instLastW:0, instToDate:0 });
  }, [filteredRows, reportData]);

  const deliveryPct = pct(totals?.delToDate, totals?.planned);
  const installThisWeekPct = pct(totals?.instThisW, totals?.planned);
  const installLastWeekPct = pct(totals?.instLastW, totals?.planned);
  const installPct = pct(totals?.instToDate, totals?.planned);
  const installWeekChangePct = pctChange(totals?.instThisW, totals?.instLastW);
  const installWeekChangeColor = installWeekChangePct > 0 ? '#15803d' : installWeekChangePct < 0 ? '#dc2626' : '#64748b';
  const selectedProject = projects.find(p => String(p.id) === String(projectId));

  const pageStyle = {
    fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
    background: '#f4f7fb',
    minHeight: '100%',
    margin: '-16px',
    padding: '10px 12px 18px',
    color: '#0f172a'
  };
  const cardStyle = {
    background: '#fff',
    border: '1px solid #dbe7f5',
    borderRadius: 14,
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.04)'
  };
  const fieldLabel = {
    display: 'block',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#243b64',
    marginBottom: 6
  };
  const inputStyle = {
    width: '100%',
    height: 34,
    border: '1px solid #cbd8ea',
    borderRadius: 8,
    background: '#fff',
    color: '#0f172a',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    padding: '0 10px',
    boxSizing: 'border-box'
  };
  const primaryButton = {
    height: 34,
    border: 'none',
    borderRadius: 9,
    background: '#2563eb',
    color: '#fff',
    fontSize: 13,
    fontWeight: 800,
    padding: '0 14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 5px 14px rgba(37, 99, 235, 0.18)'
  };
  const ghostButton = {
    height: 34,
    border: '1px solid #cbd8ea',
    borderRadius: 9,
    background: '#fff',
    color: '#1e3a8a',
    fontSize: 13,
    fontWeight: 800,
    padding: '0 12px',
    cursor: 'pointer',
    fontFamily: 'inherit'
  };
  const clearButton = {
    position: 'absolute',
    right: 6,
    top: 25,
    width: 22,
    height: 22,
    border: '1px solid #cbd8ea',
    borderRadius: 999,
    background: '#fff',
    color: '#64748b',
    fontSize: 14,
    fontWeight: 900,
    lineHeight: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(15,23,42,0.06)'
  };
  const thBase = {
    background: '#eaf2ff',
    color: '#0f2e5f',
    fontWeight: 900,
    fontSize: 11,
    padding: '10px 12px',
    borderBottom: '1px solid #cbdcf6',
    borderTop: '1px solid #dbe7f5',
    whiteSpace: 'nowrap',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    verticalAlign: 'bottom',
    overflow: 'hidden'
  };
  const thS = { ...thBase, textAlign: 'left' };
  const thR = { ...thBase, textAlign: 'right' };
  const thC = { ...thBase, textAlign: 'center' };
  const tdBase = { padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' };
  const tdR = { ...tdBase, textAlign: 'right' };
  const pctColor = p => p >= 60 ? '#15803d' : '#2563eb';

  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, padding: '10px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1f57b8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, flexShrink: 0 }}>📅</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: '#111827', margin: 0, letterSpacing: '-0.2px' }}>Weekly Summary Report</h1>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Delivery and installation weekly progress from Saturday to Thursday.</div>
        </div>
        {reportData?.rows?.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={printPDF} style={ghostButton}>Print PDF</button>
            <button onClick={exportCSV} style={primaryButton}>Export</button>
          </div>
        )}
      </div>

      <div style={{ ...cardStyle, padding: 10, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.7fr) minmax(110px, .7fr) minmax(130px, .8fr) minmax(120px, .8fr) minmax(260px, 1.4fr)', gap: 10, alignItems: 'end' }}>
          <div style={{ position: 'relative' }}>
            <label style={fieldLabel}>Project</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inputStyle}>
              <option value="">— Select Project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
            </select>
          </div>

          <div style={{ position: 'relative' }}>
            <label style={fieldLabel}>Year</label>
            <select value={selectedYear} onChange={e => { setSelectedYear(e.target.value); setSelectedMonth(''); setWeekNum(''); setWeekInput(''); setReportData(null); }} disabled={!years.length} style={{ ...inputStyle, background: years.length ? '#fff' : '#f8fafc' }}>
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div style={{ position: 'relative' }}>
            <label style={fieldLabel}>Month</label>
            <select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setWeekNum(''); setWeekInput(''); setReportData(null); }} disabled={!selectedYear || !months.length} style={{ ...inputStyle, background: selectedYear && months.length ? '#fff' : '#f8fafc' }}>
              <option value="">All Months</option>
              {months.map(m => <option key={m} value={m}>{monthName(m)}</option>)}
            </select>
          </div>

          <div style={{ position: 'relative' }}>
            <label style={fieldLabel}>Week</label>
            <input value={weekInput} onChange={e => handleWeekInput(e.target.value)} placeholder="Week" disabled={!weeks.length} style={{ ...inputStyle, fontWeight: 800, textAlign: 'center', background: weeks.length ? '#fff' : '#f8fafc' }} />
          </div>

          <div style={{ position: 'relative' }}>
            <label style={fieldLabel}>Week</label>
            <select value={weekNum} onChange={e => { setWeekNum(e.target.value); setWeekInput(e.target.value); }} disabled={!filteredWeeks.length} style={{ ...inputStyle, background: filteredWeeks.length ? '#fff' : '#f8fafc' }}>
              <option value="">— Select Week —</option>
              {filteredWeeks.map(w => <option key={w.weekNum} value={w.weekNum}>{w.label}</option>)}
            </select>
          </div>
        </div>

        {projectId && reportData?.rows?.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e5edf8', display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 1.1fr) auto', gap: 10, alignItems: 'end' }}>
            <div style={{ position: 'relative' }}>
              <label style={fieldLabel}>Classification</label>
              <select value={classificationFilter} onChange={e => setClassificationFilter(e.target.value)} style={inputStyle}>
                <option value="">All Classifications</option>
                {classifications.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ position: 'relative' }}>
              <label style={fieldLabel}>Search</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item code, item name, unit, or classification..." style={inputStyle} />
            </div>
            <button onClick={() => { setSearch(''); setClassificationFilter(''); }} style={ghostButton}>Clear Filters</button>
          </div>
        )}
      </div>

      {selectedWeek && (
        <div style={{ ...cardStyle, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderColor: '#bfdbfe', background: '#f8fbff' }}>
          <span style={{ fontSize: 12, color: '#1e3a8a', fontWeight: 900 }}>Selected Week</span>
          <span style={{ fontSize: 12, color: '#475569' }}>Week {selectedWeek.weekNum}</span>
          <span style={{ fontSize: 12, color: '#475569' }}>{formatDisplay(selectedWeek.sat)} (Sat) → {formatDisplay(selectedWeek.thu)} (Thu)</span>
          {selectedProject && <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>{projectLabel(selectedProject)}</span>}
        </div>
      )}

      {!projectId && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '70px 20px', color: '#64748b' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>📅</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#334155' }}>Select a project to generate the weekly summary</div>
        </div>
      )}

      {projectId && !loading && weeks.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '70px 20px', color: '#64748b' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>📦</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#334155' }}>No delivery or installation records found for this project</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Weeks are generated from the first to last delivery/installation transaction date.</div>
        </div>
      )}

      {projectId && weeks.length > 0 && !selectedWeek && !loading && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '52px 20px', color: '#64748b' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>👆</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#334155' }}>Enter Week or select Week</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Project has <strong style={{ color: '#2563eb' }}>{weeks.length}</strong> weeks from <strong style={{ color: '#2563eb' }}>{formatDisplay(firstDate)}</strong>{lastDate ? <> to <strong style={{ color: '#2563eb' }}>{formatDisplay(lastDate)}</strong></> : null}.</div>
        </div>
      )}

      {loading && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 50, color: '#64748b' }}>
          <div className="spinner" />
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700 }}>Loading weekly summary...</div>
        </div>
      )}

      {!loading && reportData?.rows?.length > 0 && selectedWeek && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Planned Qty', value: fmt2(totals.planned), color: '#2563eb', bg: '#fff' },
              { label: 'Delivered Until Week End', value: fmt2(totals.delToDate), color: '#2563eb', bg: '#fff' },
              { label: 'Delivery % of Planning', value: `${deliveryPct.toFixed(1)}%`, color: '#2563eb', bg: '#fff' },
              { label: 'Installed This Week', value: `${fmt2(totals.instThisW)} • ${installThisWeekPct.toFixed(1)}%`, color: '#15803d', bg: '#fff' },
              { label: 'Installed Previous Week', value: `${fmt2(totals.instLastW)} • ${installLastWeekPct.toFixed(1)}%`, color: '#15803d', bg: '#fff' },
              { label: 'Installation % of Planning', value: `${installPct.toFixed(1)}%`, color: '#15803d', bg: '#fff' },
              { label: 'Installation Change vs Last Week', value: changeText(installWeekChangePct), color: installWeekChangePct >= 0 ? '#15803d' : '#2563eb', bg: '#fff' },
            ].map(k => (
              <div key={k.label} style={{ ...cardStyle, padding: '13px 14px', background: '#fff', borderLeft: `4px solid ${k.color}` }}>
                <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: 5 }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #dbe7f5', background: '#f8fbff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#0f2e5f' }}>Weekly Summary Details</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Showing {pagedRows.length} of {filteredRows.length} items</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 1060, borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '19%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th colSpan={4} style={{ ...thS, background: '#eaf2ff', color: '#0f2e5f', borderRight: '2px solid #d4e3f8' }}>Item / Planning</th>
                    <th colSpan={2} style={{ ...thC, background: '#dbeafe', color: '#1d4ed8', borderRight: '2px solid #bfdbfe' }}>Delivery</th>
                    <th colSpan={5} style={{ ...thC, background: '#dcfce7', color: '#15803d' }}>Installation</th>
                  </tr>
                  <tr>
                    <th style={thS}>Item Code</th>
                    <th style={thS}>Item Name</th>
                    <th style={thC}>Unit</th>
                    <th style={{ ...thR, borderRight: '2px solid #d4e3f8' }}>Planned</th>
                    <th style={{ ...thR, background: '#eff6ff' }}>Until Week End</th>
                    <th style={{ ...thC, background: '#eff6ff', borderRight: '2px solid #bfdbfe' }}>Delivery %</th>
                    <th style={{ ...thR, background: '#f0fdf4' }}>This Week</th>
                    <th style={{ ...thC, background: '#f0fdf4' }}>This Week %</th>
                    <th style={{ ...thC, background: '#f0fdf4' }}>Last Week %</th>
                    <th style={{ ...thR, background: '#f0fdf4' }}>Until Week End</th>
                    <th style={{ ...thC, background: '#f0fdf4' }}>Until Week End %</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedForPage).map(([group, items]) => {
                    const gPlanned = items.reduce((s,r) => s + (parseFloat(r.planned_qty) || 0), 0);
                    const gDelToDate = items.reduce((s,r) => s + (parseFloat(r.delivered_to_date) || 0), 0);
                    const gInstThisW = items.reduce((s,r) => s + (parseFloat(r.installed_this_week) || 0), 0);
                    const gInstLastW = items.reduce((s,r) => s + (parseFloat(r.installed_last_week) || 0), 0);
                    const gInstToDate = items.reduce((s,r) => s + (parseFloat(r.installed_to_date) || 0), 0);
                    const gDelPct = pct(gDelToDate, gPlanned);
                    const gInstThisPct = pct(gInstThisW, gPlanned);
                    const gInstLastPct = pct(gInstLastW, gPlanned);
                    const gInstPct = pct(gInstToDate, gPlanned);
                    return (
                      <>
                        <tr key={`g-${group}`} style={{ background: '#f1f6ff' }}>
                          <td colSpan={4} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 900, color: '#1d4ed8', letterSpacing: '0.04em', borderRight: '2px solid #d4e3f8' }}>{group}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 900, color: '#1d4ed8', background: '#eff6ff' }}>{fmt2(gDelToDate)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 900, color: pctColor(gDelPct), background: '#eff6ff', borderRight: '2px solid #bfdbfe' }}>{gDelPct.toFixed(1)}%</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 900, color: '#15803d', background: '#f0fdf4' }}>{fmt2(gInstThisW)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 900, color: pctColor(gInstThisPct), background: '#f0fdf4' }}>{gInstThisPct.toFixed(1)}%</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 900, color: pctColor(gInstLastPct), background: '#f0fdf4' }}>{gInstLastPct.toFixed(1)}%</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 900, color: '#15803d', background: '#f0fdf4' }}>{fmt2(gInstToDate)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 900, color: pctColor(gInstPct), background: '#f0fdf4' }}>{gInstPct.toFixed(1)}%</td>
                        </tr>

                        {items.map((row, idx) => {
                          const planned = parseFloat(row.planned_qty) || 0;
                          const delToDate = parseFloat(row.delivered_to_date) || 0;
                          const instThisW = parseFloat(row.installed_this_week) || 0;
                          const instLastW = parseFloat(row.installed_last_week) || 0;
                          const instToDate = parseFloat(row.installed_to_date) || 0;
                          const delPct = pct(delToDate, planned);
                          const instThisPct = pct(instThisW, planned);
                          const instLastPct = pct(instLastW, planned);
                          const instPct = pct(instToDate, planned);
                          return (
                            <tr key={row.item_id} style={{ borderBottom: '1px solid #eaf0f8', background: idx % 2 === 0 ? '#fff' : '#fbfdff' }}>
                              <td style={{ ...tdBase, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, color: '#475569' }}>{row.item_code}</td>
                              <td style={{ ...tdBase, fontWeight: 800, color: '#111827' }}>{row.item_name}</td>
                              <td style={{ ...tdBase, textAlign: 'center', color: '#64748b' }}>{row.unit_of_measure || '—'}</td>
                              <td style={{ ...tdR, fontWeight: 800, color: '#111827', borderRight: '2px solid #d4e3f8' }}>{fmt2(planned)}</td>
                              <td style={{ ...tdR, fontWeight: 800, color: '#1d4ed8', background: '#f8fbff' }}>{fmt2(delToDate)}</td>
                              <td style={{ ...tdBase, background: '#f8fbff', borderRight: '2px solid #bfdbfe' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                  <div style={{ width: 52, height: 5, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, delPct)}%`, background: pctColor(delPct), borderRadius: 99 }} /></div>
                                  <span style={{ fontSize: 11, fontWeight: 900, color: pctColor(delPct), width: 40, textAlign: 'right' }}>{delPct.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td style={{ ...tdR, fontWeight: 900, color: instThisW > 0 ? '#15803d' : '#94a3b8', background: '#fbfffc' }}>{instThisW > 0 ? fmt2(instThisW) : '—'}</td>
                              <td style={{ ...tdR, fontWeight: 900, color: instThisW > 0 ? pctColor(instThisPct) : '#cbd5e1', background: '#fbfffc' }}>{instThisW > 0 ? `${instThisPct.toFixed(1)}%` : '—'}</td>
                              <td style={{ ...tdR, fontWeight: 900, color: instLastW > 0 ? pctColor(instLastPct) : '#cbd5e1', background: '#fbfffc' }}>{instLastW > 0 ? `${instLastPct.toFixed(1)}%` : '—'}</td>
                              <td style={{ ...tdR, fontWeight: 800, color: '#15803d', background: '#fbfffc' }}>{fmt2(instToDate)}</td>
                              <td style={{ ...tdBase, background: '#fbfffc' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                  <div style={{ width: 52, height: 5, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, instPct)}%`, background: pctColor(instPct), borderRadius: 99 }} /></div>
                                  <span style={{ fontSize: 11, fontWeight: 900, color: pctColor(instPct), width: 40, textAlign: 'right' }}>{instPct.toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#eaf2ff', borderTop: '2px solid #cbdcf6' }}>
                    <td colSpan={3} style={{ ...tdBase, fontWeight: 900, color: '#0f2e5f' }}>TOTAL — {filteredRows.length} items</td>
                    <td style={{ ...tdR, fontWeight: 900, color: '#111827', borderRight: '2px solid #d4e3f8' }}>{fmt2(totals.planned)}</td>
                    <td style={{ ...tdR, fontWeight: 900, color: '#1d4ed8', background: '#dbeafe' }}>{fmt2(totals.delToDate)}</td>
                    <td style={{ ...tdR, fontWeight: 900, color: pctColor(deliveryPct), background: '#dbeafe', borderRight: '2px solid #bfdbfe' }}>{deliveryPct.toFixed(1)}%</td>
                    <td style={{ ...tdR, fontWeight: 900, color: '#15803d', background: '#dcfce7' }}>{fmt2(totals.instThisW)}</td>
                    <td style={{ ...tdR, fontWeight: 900, color: pctColor(installThisWeekPct), background: '#dcfce7' }}>{installThisWeekPct.toFixed(1)}%</td>
                    <td style={{ ...tdR, fontWeight: 900, color: pctColor(installLastWeekPct), background: '#dcfce7' }}>{installLastWeekPct.toFixed(1)}%</td>
                    <td style={{ ...tdR, fontWeight: 900, color: '#15803d', background: '#dcfce7' }}>{fmt2(totals.instToDate)}</td>
                    <td style={{ ...tdR, fontWeight: 900, color: pctColor(installPct), background: '#dcfce7' }}>{installPct.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ display:'flex', alignItems:'center', padding:'12px 18px', borderTop:'1px solid #f3f4f6', gap:8, background:'#fff' }}>
              <span style={{ fontSize:12, color:'#64748b' }}><strong style={{ color:'#2563eb' }}>{filteredRows.length}</strong> rows</span>
              <div style={{ display:'flex', gap:4, flex:1, justifyContent:'center' }}>
                <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={currentPage===1} style={{ minWidth:32, height:32, borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:currentPage===1?'not-allowed':'pointer', opacity:currentPage===1?0.4:1, fontFamily:'inherit' }}>‹</button>
                {Array.from({length:Math.min(5,totalPages)},(_,i)=>Math.min(Math.max(1, currentPage - 2), Math.max(1, totalPages - 4)) + i).filter(p=>p<=totalPages).map(p=>(
                  <button key={p} onClick={()=>setPage(p)} style={{ minWidth:32, height:32, borderRadius:8, border:p===currentPage?'1.5px solid #2563eb':'1px solid #e5e7eb', background:p===currentPage?'#2563eb':'#fff', color:p===currentPage?'#fff':'#374151', fontWeight:p===currentPage?700:400, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>{p}</button>
                ))}
                <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages} style={{ minWidth:32, height:32, borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:currentPage===totalPages?'not-allowed':'pointer', opacity:currentPage===totalPages?0.4:1, fontFamily:'inherit' }}>›</button>
              </div>
              <select value={rowsPerPage} onChange={e=>{setRowsPerPage(Number(e.target.value));setPage(1);}} style={{ border:'1px solid #dbeafe', color:'#2563eb', background:'#fff', borderRadius:8, padding:'6px 10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                {[10,25,50,100].map(n=><option key={n} value={n}>{n} per page</option>)}
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
