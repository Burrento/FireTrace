import { useState } from 'react';
import { apiFetch } from '../../api';
import BfpShell from './BfpShell';
import { useBfpPage, usePolledResource } from './useDashboardData';

/* Backup, from /api/dashboard/backup/export/.

   Export is real: the server assembles every report, incident, timeline event,
   audit entry and account into one JSON file, records the export in the audit
   log, and hands it back as a download. Password hashes are excluded.

   Restore is deliberately not a button. Replacing a live database from an
   uploaded file is destructive and all-or-nothing, and putting it behind a
   form any signed-in operator can reach means one mis-click loses the record
   of every fire reported so far. The recovery path is the platform's own
   point-in-time restore, which is described below rather than faked. */

const REFRESH_MS = 60000;

function BfpBackup() {
  const { tick, lastRefresh, refreshNow, live, onAuthError } = useBfpPage(REFRESH_MS);
  const health = usePolledResource('/api/dashboard/health/', tick, { onAuthError });

  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [lastExport, setLastExport] = useState(null);

  const counts = health.data?.record_counts;

  async function createBackup() {
    setExporting(true);
    setMessage('');
    setFailed(false);
    try {
      const payload = await apiFetch('/api/dashboard/backup/export/');

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      link.href = url;
      link.download = `firetrace-export-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Object URLs live until revoked; without this each export would leak
      // the whole payload for the life of the tab.
      URL.revokeObjectURL(url);

      const exported = payload.meta?.counts;
      setLastExport({ at: new Date(), counts: exported });
      setMessage(
        `Exported ${exported?.reports ?? 0} reports, ${exported?.incidents ?? 0} incidents and ${
          exported?.audit_entries ?? 0
        } audit entries.`,
      );
      // The export writes an audit entry, so the rest of the portal has
      // something new to show.
      refreshNow();
    } catch (err) {
      setFailed(true);
      setMessage(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <BfpShell live={live} lastRefresh={lastRefresh} refreshNow={refreshNow}>
      <h1 className="bfp-page-title">Backup &amp; Restore</h1>

      {message && (
        <div
          className={failed ? 'bfp-inline-error' : 'bfp-settings-saved'}
          style={{ margin: '0 2px 4px' }}
        >
          {message}
        </div>
      )}

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Export data</h2>
          <span className="bfp-panel-sub">
            {counts
              ? `${counts.reports} reports · ${counts.incidents} incidents · ${counts.audit_entries} audit entries`
              : 'Counting…'}
          </span>
        </div>
        <div className="bfp-backup-body">
          <div className="bfp-backup-row">
            <button
              type="button"
              className="bfp-btn-primary"
              onClick={createBackup}
              disabled={exporting}
            >
              <i className="fa-solid fa-database" />
              {exporting ? 'Exporting…' : 'Export now'}
            </button>
            {lastExport && (
              <span className="bfp-file-name">
                Last export {lastExport.at.toLocaleTimeString()}
              </span>
            )}
          </div>
          <p className="bfp-backup-note">
            One JSON file containing every report, incident, timeline event,
            audit entry and account, plus the operational settings in force.
            Password hashes are excluded. Uploaded photographs are not included:
            they live in blob storage and are backed up with it. The export is
            itself recorded in the audit log.
          </p>
        </div>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Restore</h2>
          <span className="bfp-panel-sub">Performed on the platform, not here</span>
        </div>
        <div className="bfp-danger-note">
          <i className="fa-solid fa-triangle-exclamation" />
          Restoring replaces every report on file. It is not exposed as a button
          in this portal on purpose.
        </div>
        <div className="bfp-backup-body" style={{ paddingTop: 0 }}>
          <p className="bfp-backup-note">
            The database is Azure Database for PostgreSQL, which keeps automatic
            backups and supports point-in-time restore. A restore creates a{' '}
            <em>new</em> server from a chosen moment, so the current data is
            still there if the decision turns out to be wrong — which a file
            upload overwriting the live database in place could not offer.
          </p>
          <p className="bfp-backup-note">
            Run it from the Azure portal, or:
          </p>
          <pre className="bfp-backup-note" style={{ whiteSpace: 'pre-wrap' }}>
{`az postgres flexible-server restore \\
  --resource-group firetrace-rg \\
  --name firetrace-db-restored \\
  --source-server firetrace-db \\
  --restore-time "2026-09-01T09:00:00Z"`}
          </pre>
          <p className="bfp-backup-note">
            The JSON export above is the archival copy, for records and for the
            thesis. It is not the restore path.
          </p>
        </div>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Scheduled backups</h2>
        </div>
        <div className="bfp-backup-body">
          <p className="bfp-backup-note">
            Handled by the platform. Azure takes automatic PostgreSQL backups on
            its own retention schedule, and uploaded photographs are held in the
            <code> firetracemedia </code> storage account. There is no scheduler
            in this application, so nothing here claims to run one — an
            unattended job that silently stopped would be worse than none.
          </p>
        </div>
      </section>
    </BfpShell>
  );
}

export default BfpBackup;
