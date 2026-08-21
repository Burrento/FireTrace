/* System health indicators.

   Each row shows how its status was established: `live` means the component
   was actually exercised on this request, `config` means only its
   configuration was inspected. Showing the difference keeps an operator from
   reading a configuration check as proof the service is reachable. */

const STATUS_ICON = {
  operational: 'fa-circle-check',
  degraded: 'fa-triangle-exclamation',
  down: 'fa-circle-xmark',
};

function SystemHealth({ data, loading, error }) {
  const components = data?.components ?? [];

  return (
    <section className="bfp-panel bfp-health-panel">
      <header className="bfp-panel-head">
        <h2 className="bfp-panel-title">System Health</h2>
        {data?.overall && (
          <span className={`bfp-health-overall is-${data.overall}`}>{data.overall}</span>
        )}
      </header>

      {error && <p className="bfp-inline-error">{error}</p>}
      {loading && !data && <p className="bfp-panel-muted">Checking services…</p>}

      <ul className="bfp-health-list">
        {components.map((component) => (
          <li key={component.key} className="bfp-health-row">
            <i
              className={`fa-solid ${STATUS_ICON[component.status] || 'fa-circle'} bfp-health-icon is-${component.status}`}
            />
            <div className="bfp-health-text">
              <span className="bfp-health-label">{component.label}</span>
              <span className="bfp-health-detail">{component.detail}</span>
            </div>
            <span className={`bfp-health-check is-${component.check}`}>{component.check}</span>
          </li>
        ))}
      </ul>

      {data?.realtime_transport && (
        <p className="bfp-panel-foot">
          Updates via {data.realtime_transport}
        </p>
      )}
    </section>
  );
}

export default SystemHealth;
