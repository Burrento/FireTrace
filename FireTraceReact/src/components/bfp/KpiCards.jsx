/* The five summary cards across the top of the dashboard.

   Each card states the record type it counts. Intake pressure is measured in
   reports, operational load in canonical incidents, and the label makes that
   explicit so the two are never read as one number. */

const CARD_ICONS = {
  new_reports: 'fa-inbox',
  under_review: 'fa-magnifying-glass',
  duplicates: 'fa-clone',
  responding: 'fa-truck-fast',
  resolved: 'fa-circle-check',
};

function KpiCards({ data, loading }) {
  if (loading && !data) {
    return (
      <div className="bfp-kpi-row">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="bfp-kpi-card bfp-kpi-skeleton" />
        ))}
      </div>
    );
  }

  const cards = data?.cards ?? [];

  return (
    <div className="bfp-kpi-row">
      {cards.map((card) => (
        <article key={card.key} className={`bfp-kpi-card bfp-kpi-${card.key}`}>
          <div className="bfp-kpi-top">
            <span className="bfp-kpi-label">{card.label}</span>
            <i className={`fa-solid ${CARD_ICONS[card.key] || 'fa-circle'} bfp-kpi-icon`} />
          </div>
          <div className="bfp-kpi-value">{card.value}</div>
          <div className="bfp-kpi-foot">
            <span className="bfp-kpi-scope">{card.scope}</span>
            <span className="bfp-kpi-detail">{card.detail}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export default KpiCards;
