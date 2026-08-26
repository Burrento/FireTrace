/* Recent Activity — the audit trail of personnel actions.

   Merged server-side from AUDIT_LOG (what a person did) and the system-raised
   entries of INCIDENT_TIMELINE_EVENT (such as a duplicate flag). Entries
   attributed to "System" were raised by the flagging rule, not by staff; the
   distinction matters when reconstructing who decided what. */

const ACTION_ICONS = {
  report_submitted: 'fa-file-circle-plus',
  status_updated: 'fa-arrow-right-arrow-left',
  incident_verified: 'fa-shield-halved',
  dispatch_assigned: 'fa-truck-fast',
  duplicate_reviewed: 'fa-clone',
  duplicate_flagged: 'fa-flag',
  report_linked: 'fa-link',
  note_added: 'fa-note-sticky',
};

function relativeTime(iso) {
  const elapsedMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (elapsedMin < 1) return 'just now';
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  if (elapsedMin < 1440) return `${Math.floor(elapsedMin / 60)}h ago`;
  return `${Math.floor(elapsedMin / 1440)}d ago`;
}

function ActivityFeed({ data, loading, error }) {
  const entries = Array.isArray(data) ? data : [];

  return (
    <section className="bfp-panel bfp-activity-panel">
      <header className="bfp-panel-head">
        <h2 className="bfp-panel-title">Recent Activity</h2>
      </header>

      {error && <p className="bfp-inline-error">{error}</p>}
      {loading && !data && <p className="bfp-panel-muted">Loading activity…</p>}
      {!loading && entries.length === 0 && (
        <p className="bfp-panel-muted">No recorded activity yet.</p>
      )}

      <ol className="bfp-activity-list">
        {entries.map((entry) => (
          <li key={entry.id} className="bfp-activity-item">
            <span className="bfp-activity-icon">
              <i className={`fa-solid ${ACTION_ICONS[entry.action] || 'fa-circle-dot'}`} />
            </span>
            <div className="bfp-activity-body">
              <p className="bfp-activity-summary">{entry.summary}</p>
              <p className="bfp-activity-meta">
                <span
                  className={
                    entry.actor_name === 'System'
                      ? 'bfp-activity-actor is-system'
                      : 'bfp-activity-actor'
                  }
                >
                  {entry.actor_name}
                </span>
                <span className="bfp-activity-dot">·</span>
                <span title={new Date(entry.created_at).toLocaleString()}>
                  {relativeTime(entry.created_at)}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default ActivityFeed;
