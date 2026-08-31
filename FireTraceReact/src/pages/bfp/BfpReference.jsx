import BfpShell from './BfpShell';
import { useBfpPage, usePolledResource } from './useDashboardData';

/* Reference Data, from /api/dashboard/reference/.

   Read-only, and derived rather than restated. The confidence table is built
   by the server calling the real grading function, and the barangay list comes
   from the reports actually on file, so neither can drift away from what the
   system does. The rules panel shows the thresholds currently in force; the
   editable ones live on the Settings page. */

const REFRESH_MS = 60000;

const GRADE_BADGE = {
  High: 'bfp-badge-resolved',
  Medium: 'bfp-badge-responding',
  Low: 'bfp-badge-not-flagged',
};

function Panel({ title, sub, children }) {
  return (
    <section className="bfp-panel">
      <div className="bfp-panel-head">
        <h2 className="bfp-panel-title">{title}</h2>
        {sub && <span className="bfp-panel-sub">{sub}</span>}
      </div>
      <div className="bfp-table-wrap">{children}</div>
    </section>
  );
}

function Empty({ colSpan, loading, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className="bfp-table-empty">
        {loading ? 'Loading…' : message}
      </td>
    </tr>
  );
}

function BfpReference() {
  const { tick, lastRefresh, refreshNow, live, onAuthError } = useBfpPage(REFRESH_MS);
  const { data, loading, error } = usePolledResource('/api/dashboard/reference/', tick, {
    onAuthError,
  });

  const barangays = data?.barangays ?? [];
  const categories = data?.incident_types ?? [];
  const confidence = data?.confidence_grading ?? [];
  const rules = data?.rules ?? [];

  return (
    <BfpShell live={live} lastRefresh={lastRefresh} refreshNow={refreshNow}>
      <h1 className="bfp-page-title">Reference Data</h1>

      {error && <p className="bfp-inline-error">{error}</p>}

      <Panel
        title="Barangays"
        sub={`${barangays.length} with reports on file`}
      >
        <table className="bfp-table">
          <thead>
            <tr>
              <th>Barangay</th>
              <th>Reports</th>
            </tr>
          </thead>
          <tbody>
            {barangays.map((barangay) => (
              <tr key={barangay.name}>
                <td>{barangay.name}</td>
                <td>{barangay.reports}</td>
              </tr>
            ))}
            {barangays.length === 0 && (
              <Empty
                colSpan={2}
                loading={loading}
                message="No reports have been filed yet, so no barangay appears here."
              />
            )}
          </tbody>
        </table>
      </Panel>

      <Panel title="Fire categories" sub={`${categories.length} entries`}>
        <table className="bfp-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Stored value</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.value}>
                <td>{category.label}</td>
                <td className="bfp-ref">{category.value}</td>
              </tr>
            ))}
            {categories.length === 0 && (
              <Empty colSpan={2} loading={loading} message="No categories." />
            )}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Location confidence grading"
        sub="Graded server-side, from how the coordinate was captured"
      >
        <table className="bfp-table">
          <thead>
            <tr>
              <th>Location source</th>
              <th>GPS accuracy</th>
              <th>Confidence</th>
              <th>On the map</th>
            </tr>
          </thead>
          <tbody>
            {confidence.map((row, index) => (
              <tr key={`${row.source}-${row.accuracy_m ?? index}`}>
                <td>{row.source}</td>
                <td>{row.accuracy_note}</td>
                <td>
                  <span className={`bfp-badge ${GRADE_BADGE[row.grade] ?? ''}`}>
                    {row.grade}
                  </span>
                </td>
                <td>{row.mappable ? 'Plotted' : 'Withheld'}</td>
              </tr>
            ))}
            {confidence.length === 0 && (
              <Empty colSpan={4} loading={loading} message="No grading rules." />
            )}
          </tbody>
        </table>
      </Panel>

      <Panel title="Detection rules" sub="Values currently in force">
        <table className="bfp-table">
          <thead>
            <tr>
              <th>Setting</th>
              <th>Value</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.key}>
                <td>{rule.label}</td>
                <td>{rule.value}</td>
                <td>
                  {rule.note}
                  {!rule.editable && (
                    <span className="bfp-panel-sub"> · not editable in the portal</span>
                  )}
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <Empty colSpan={3} loading={loading} message="No rules." />
            )}
          </tbody>
        </table>
      </Panel>
    </BfpShell>
  );
}

export default BfpReference;
