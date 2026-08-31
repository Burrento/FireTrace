import BfpShell from './BfpShell';

const DEMO_BARANGAYS = [
  { id: 1, name: 'Ibaba East', zone: 'Poblacion', station: 'Central' },
  { id: 2, name: 'Ibaba West', zone: 'Poblacion', station: 'Central' },
  { id: 3, name: 'Sta. Isabel', zone: 'North', station: 'Central' },
  { id: 4, name: 'Canubing I', zone: 'South', station: 'Sub-station 2' },
  { id: 5, name: 'Lalud', zone: 'North', station: 'Sub-station 1' },
  { id: 6, name: 'Guinobatan', zone: 'Coastal', station: 'Central' },
];

const DEMO_CATEGORIES = [
  { id: 1, label: 'Residential Fire', code: 'RES' },
  { id: 2, label: 'Commercial Fire', code: 'COM' },
  { id: 3, label: 'Electrical Fire', code: 'ELE' },
  { id: 4, label: 'Vehicular Fire', code: 'VEH' },
  { id: 5, label: 'Grass / Rubbish Fire', code: 'GRS' },
  { id: 6, label: 'Other', code: 'OTH' },
];

const DEMO_CONFIDENCE = [
  { source: 'Device GPS', accuracy: '≤ 25 m', grade: 'High' },
  { source: 'Device GPS', accuracy: '26 – 100 m', grade: 'Medium' },
  { source: 'Map pin', accuracy: 'n/a', grade: 'Medium' },
  { source: 'Typed address', accuracy: 'n/a', grade: 'Low' },
  { source: 'Device GPS', accuracy: '> 100 m', grade: 'Low' },
];

const DEMO_RULES = [
  { key: 'Duplicate radius', value: '150 m', note: 'Haversine distance between two reports' },
  { key: 'Duplicate time window', value: '30 min', note: 'Both radius and window must hold' },
  { key: 'Recent map window', value: '1 / 6 / 24 h', note: 'Live dashboard, default 1 h' },
  { key: 'Photo URL lifetime', value: '1 h', note: 'SAS-signed, then re-issued' },
];

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

function BfpReference() {
  return (
    <BfpShell>
      <h1 className="bfp-page-title">Reference Data</h1>

      <Panel title="Barangays" sub={`${DEMO_BARANGAYS.length} entries · demo data`}>
        <table className="bfp-table">
          <thead>
            <tr>
              <th>Barangay</th>
              <th>Zone</th>
              <th>Responding station</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_BARANGAYS.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.zone}</td>
                <td>{b.station}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Fire categories" sub={`${DEMO_CATEGORIES.length} entries · demo data`}>
        <table className="bfp-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Code</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_CATEGORIES.map((c) => (
              <tr key={c.id}>
                <td>{c.label}</td>
                <td>{c.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Location confidence grading" sub="Server-side · demo data">
        <table className="bfp-table">
          <thead>
            <tr>
              <th>Location source</th>
              <th>GPS accuracy</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_CONFIDENCE.map((r, i) => (
              <tr key={i}>
                <td>{r.source}</td>
                <td>{r.accuracy}</td>
                <td>
                  <span className={`bfp-badge ${GRADE_BADGE[r.grade]}`}>{r.grade}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Detection rules" sub="Read-only · demo data">
        <table className="bfp-table">
          <thead>
            <tr>
              <th>Setting</th>
              <th>Value</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_RULES.map((r) => (
              <tr key={r.key}>
                <td>{r.key}</td>
                <td>{r.value}</td>
                <td>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </BfpShell>
  );
}

export default BfpReference;
