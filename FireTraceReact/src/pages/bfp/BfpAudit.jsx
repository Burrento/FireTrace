import { useMemo, useState } from 'react';
import BfpShell from './BfpShell';

const DEMO_REPORTS = [
  { ref: 'FT-2026-00021', barangay: 'Ibaba East', category: 'Other', submitted: '2026-08-27T21:00:00' },
  { ref: 'FT-2026-00008', barangay: 'Canubing I', category: 'Electrical Fire', submitted: '2026-08-27T20:40:00' },
  { ref: 'FT-2026-00009', barangay: 'Ibaba West', category: 'Electrical Fire', submitted: '2026-08-27T20:31:00' },
  { ref: 'FT-2026-00024', barangay: 'Ibaba West', category: 'Residential Fire', submitted: '2026-08-27T19:42:00' },
  { ref: 'FT-2026-00028', barangay: 'Sta. Isabel', category: 'Residential Fire', submitted: '2026-08-27T18:48:00' },
  { ref: 'FT-2026-00027', barangay: 'Sta. Isabel', category: 'Residential Fire', submitted: '2026-08-27T18:45:00' },
];

/* One demo report becomes a few audit rows. Minutes are offsets after the
   report's own submitted time. */
const ACTIVITY_TEMPLATES = {
  'FT-2026-00021': [
    { after: 4, actor: 'insp.ricardo', action: 'Marked Under Review' },
    { after: 55, actor: 'insp.ricardo', action: 'Verified' },
    { after: 190, actor: 'ff.santos', action: 'Marked Responding' },
    { after: 320, actor: 'ff.santos', action: 'Resolved' },
  ],
  'FT-2026-00008': [{ after: 2, actor: 'system', action: 'Report received' }],
  'FT-2026-00009': [{ after: 3, actor: 'system', action: 'Report received' }],
  'FT-2026-00024': [
    { after: 1, actor: 'system', action: 'Report received' },
    { after: 12, actor: 'insp.ricardo', action: 'Marked Under Review' },
  ],
  'FT-2026-00028': [
    { after: 3, actor: 'system', action: 'Flagged possible duplicate of FT-2026-00027' },
    { after: 40, actor: 'insp.ricardo', action: 'Confirmed duplicate' },
  ],
  'FT-2026-00027': [
    { after: 3, actor: 'system', action: 'Flagged possible duplicate of FT-2026-00028' },
    { after: 41, actor: 'insp.ricardo', action: 'Kept separate' },
  ],
};

function buildLogs() {
  const rows = [];
  DEMO_REPORTS.forEach((r) => {
    (ACTIVITY_TEMPLATES[r.ref] || []).forEach((t, i) => {
      const at = new Date(new Date(r.submitted).getTime() + t.after * 60000);
      rows.push({
        id: `${r.ref}-${i}`,
        at,
        actor: t.actor,
        action: t.action,
        ref: r.ref,
        barangay: r.barangay,
        category: r.category,
      });
    });
  });
  return rows.sort((a, b) => b.at - a.at);
}

function fmt(d) {
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toCsv(rows) {
  const header = ['Timestamp', 'Actor', 'Action', 'Reference', 'Barangay', 'Category'];
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.at.toISOString(), r.actor, r.action, r.ref, r.barangay, r.category].map(escape).join(','),
  );
  return [header.map(escape).join(','), ...lines].join('\r\n');
}

function BfpAudit() {
  const allLogs = useMemo(() => buildLogs(), []);
  const [query, setQuery] = useState('');
  const [actor, setActor] = useState('all');

  const actors = useMemo(
    () => ['all', ...Array.from(new Set(allLogs.map((l) => l.actor)))],
    [allLogs],
  );

  const logs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allLogs.filter((l) => {
      if (actor !== 'all' && l.actor !== actor) return false;
      if (!q) return true;
      return (
        l.action.toLowerCase().includes(q) ||
        l.ref.toLowerCase().includes(q) ||
        l.barangay.toLowerCase().includes(q)
      );
    });
  }, [allLogs, query, actor]);

  function downloadCsv() {
    const blob = new Blob([toCsv(logs)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <BfpShell>
      <h1 className="bfp-page-title">Audit Logs</h1>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Personnel activity</h2>
          <span className="bfp-panel-sub">{logs.length} entries · demo data</span>
        </div>

        <div className="bfp-filters">
          <input
            className="bfp-filter-input"
            placeholder="Search action, reference, barangay…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="bfp-filter-select"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
          >
            {actors.map((a) => (
              <option key={a} value={a}>
                {a === 'all' ? 'All actors' : a}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="bfp-btn-csv"
            onClick={downloadCsv}
            disabled={logs.length === 0}
          >
            <i className="fa-solid fa-file-csv" /> CSV
          </button>
        </div>

        <div className="bfp-table-wrap">
          <table className="bfp-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Reference</th>
                <th>Barangay</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{fmt(l.at)}</td>
                  <td>
                    <span className={l.actor === 'system' ? 'bfp-activity-actor is-system' : ''}>
                      {l.actor}
                    </span>
                  </td>
                  <td>{l.action}</td>
                  <td>{l.ref}</td>
                  <td>{l.barangay}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="bfp-table-empty">
                    No entries match the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </BfpShell>
  );
}

export default BfpAudit;
