import { useRef, useState } from 'react';
import BfpShell from './BfpShell';

const INITIAL_BACKUPS = [
  { id: 3, at: '2026-08-31T02:00:00', size: '4.2 MB', type: 'Scheduled', status: 'Complete' },
  { id: 2, at: '2026-08-30T02:00:00', size: '4.1 MB', type: 'Scheduled', status: 'Complete' },
  { id: 1, at: '2026-08-28T14:12:00', size: '3.9 MB', type: 'Manual', status: 'Complete' },
];

function fmt(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function BfpBackup() {
  const [backups, setBackups] = useState(INITIAL_BACKUPS);
  const [creating, setCreating] = useState(false);
  const [autoBackup, setAutoBackup] = useState(true);
  const [frequency, setFrequency] = useState('daily');
  const [restoreFile, setRestoreFile] = useState(null);
  const [message, setMessage] = useState('');
  const fileInput = useRef(null);

  function createBackup() {
    setCreating(true);
    setMessage('');
    // Fake the work so the button state is visible.
    setTimeout(() => {
      const now = new Date();
      const entry = {
        id: Date.now(),
        at: now.toISOString(),
        size: `${(3.8 + Math.random() * 0.6).toFixed(1)} MB`,
        type: 'Manual',
        status: 'Complete',
      };
      setBackups((b) => [entry, ...b]);

      const blob = new Blob(
        [JSON.stringify({ createdAt: entry.at, note: 'FireTrace demo backup' }, null, 2)],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `firetrace-backup-${now.toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setCreating(false);
      setMessage('Backup created and downloaded.');
    }, 900);
  }

  function restore() {
    if (!restoreFile) return;
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      `Restore from "${restoreFile.name}"? This would overwrite current data.`,
    );
    if (!ok) return;
    setMessage(`Restore from "${restoreFile.name}" queued (demo — nothing changed).`);
    setRestoreFile(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <BfpShell>
      <h1 className="bfp-page-title">Backup &amp; Restore</h1>

      {message && <div className="bfp-settings-saved" style={{ margin: '0 2px 4px' }}>{message}</div>}

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Create backup</h2>
          <span className="bfp-panel-sub">Demo — no server call</span>
        </div>
        <div className="bfp-backup-body">
          <div className="bfp-backup-row">
            <button
              type="button"
              className="bfp-btn-primary"
              onClick={createBackup}
              disabled={creating}
            >
              <i className="fa-solid fa-database" />
              {creating ? 'Creating…' : 'Create backup now'}
            </button>
          </div>
          <p className="bfp-backup-note">
            Includes reports, incidents, users and audit log. The file downloads to this
            device.
          </p>
        </div>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Scheduled backups</h2>
        </div>
        <div className="bfp-setting-list">
          <label className="bfp-setting">
            <span className="bfp-setting-text">
              <span className="bfp-setting-label">Automatic backup</span>
              <span className="bfp-setting-hint">Run a backup on a fixed schedule</span>
            </span>
            <span className={autoBackup ? 'bfp-switch is-on' : 'bfp-switch'}>
              <input
                type="checkbox"
                checked={autoBackup}
                onChange={(e) => setAutoBackup(e.target.checked)}
              />
              <span className="bfp-switch-knob" />
            </span>
          </label>
          <label className="bfp-setting">
            <span className="bfp-setting-text">
              <span className="bfp-setting-label">Frequency</span>
            </span>
            <span className="bfp-setting-control">
              <select
                className="bfp-filter-select"
                value={frequency}
                disabled={!autoBackup}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="daily">Every day at 12:00 AM</option>
                <option value="weekly">Every Monday at 12:00 AM</option>
                <option value="monthly">1st of the month at 12:00 AM</option>
              </select>
            </span>
          </label>
        </div>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Restore</h2>
        </div>
        <div className="bfp-danger-note">
          <i className="fa-solid fa-triangle-exclamation" />
          Restoring replaces all current data with the contents of the backup file.
        </div>
        <div className="bfp-backup-body" style={{ paddingTop: 0 }}>
          <div className="bfp-backup-row">
            <button
              type="button"
              className="bfp-btn-ghost"
              onClick={() => fileInput.current?.click()}
            >
              <i className="fa-solid fa-file-arrow-up" /> Choose backup file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
            />
            {restoreFile && <span className="bfp-file-name">{restoreFile.name}</span>}
            <button
              type="button"
              className="bfp-btn-primary"
              onClick={restore}
              disabled={!restoreFile}
            >
              Restore
            </button>
          </div>
        </div>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Backup history</h2>
          <span className="bfp-panel-sub">{backups.length} entries · demo data</span>
        </div>
        <div className="bfp-table-wrap">
          <table className="bfp-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Type</th>
                <th>Size</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td>{fmt(b.at)}</td>
                  <td>{b.type}</td>
                  <td>{b.size}</td>
                  <td>
                    <span className="bfp-badge bfp-badge-resolved">{b.status}</span>
                  </td>
                  <td>
                    <button type="button" className="bfp-link-btn">
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </BfpShell>
  );
}

export default BfpBackup;
