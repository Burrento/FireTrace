import BfpShell from './BfpShell';
const DEMO_GAUGES = [
  { label: 'Reports verified', value: 67, color: 'var(--civ-status-review, #2f6f9f)' },
  { label: 'Resolved within SLA', value: 58, color: 'var(--ft-red, #e2602f)' },
  { label: 'Map coverage', value: 45, color: 'var(--civ-status-submitted, #8fc7e8)' },
];

const DEMO_BARS = [
  { label: 'Mon', value: 8 },
  { label: 'Tue', value: 14 },
  { label: 'Wed', value: 6 },
  { label: 'Thu', value: 19 },
  { label: 'Fri', value: 11 },
  { label: 'Sat', value: 22 },
  { label: 'Sun', value: 9 },
];

function Gauge({ label, value, color }) {
  const size = 120;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;

  return (
    <figure className="bfp-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${value}%`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--civ-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="bfp-gauge-value"
          fill={color}
        >
          {value}%
        </text>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const height = 180;

  return (
    <div className="bfp-bars" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="bfp-bar-col">
          <span className="bfp-bar-count">{d.value}</span>
          <div
            className="bfp-bar"
            style={{ height: `${(d.value / max) * 100}%` }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="bfp-bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function BfpOperational() {
  return (
    <BfpShell>
      <h1 className="bfp-page-title">Operational Overview</h1>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Key rates</h2>
          <span className="bfp-panel-sub">Demo data</span>
        </div>
        <div className="bfp-gauge-row">
          {DEMO_GAUGES.map((g) => (
            <Gauge key={g.label} {...g} />
          ))}
        </div>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Reports this week</h2>
          <span className="bfp-panel-sub">Demo data</span>
        </div>
        <div style={{ padding: '18px 16px' }}>
          <BarChart data={DEMO_BARS} />
        </div>
      </section>
    </BfpShell>
  );
}

export default BfpOperational;
