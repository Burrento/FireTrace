import { useEffect, useState } from 'react';
import { apiFetch } from '../../api';
import { useTheme } from '../../context/useTheme';
import BfpShell from './BfpShell';
import { useBfpPage, usePolledResource } from './useDashboardData';

/* Settings, from /api/dashboard/settings/.

   The three operational rules here are stored server-side and take effect on
   the next report submitted: `incidents.duplicates` reads them on every call
   rather than caching, and the map reads the window as its default. A change
   is written to the audit log with its old and new value, because "why was
   this flagged" has to stay answerable after someone retunes the rule.

   Theme is the exception and is deliberately local. It is a property of this
   browser, not of the installation, and storing it on the server would mean an
   operator switching to dark mode changed it for the whole station. */

const REFRESH_MS = 60000;

function Field({ label, hint, children }) {
  return (
    <label className="bfp-setting">
      <span className="bfp-setting-text">
        <span className="bfp-setting-label">{label}</span>
        {hint && <span className="bfp-setting-hint">{hint}</span>}
      </span>
      <span className="bfp-setting-control">{children}</span>
    </label>
  );
}

function BfpSettings() {
  const { tick, lastRefresh, refreshNow, live, onAuthError } = useBfpPage(REFRESH_MS);
  const { theme, preference, setTheme } = useTheme();

  const { data, loading, error } = usePolledResource('/api/dashboard/settings/', tick, {
    onAuthError,
  });

  const [edits, setEdits] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [saveError, setSaveError] = useState('');

  /* The form is derived from the server until somebody types, and only then
     becomes state. That ordering matters because this page polls: seeding a
     state variable from every fetch would overwrite an edit out from under
     whoever was halfway through making it, and seeding it only once would need
     an effect that lints as a cascading render. Clearing `edits` after a save
     hands the form back to the server's own copy. */
  const form =
    edits ??
    (data
      ? {
          duplicate_radius_m: data.duplicate_radius_m,
          duplicate_window_minutes: data.duplicate_window_minutes,
          map_recent_hours: data.map_recent_hours,
        }
      : null);

  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(() => setSaved(''), 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  function set(key, value) {
    setEdits({ ...form, [key]: value });
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      await apiFetch('/api/dashboard/settings/', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setSaved('Saved. New reports are matched against these thresholds.');
      // Drop the local copy so the form re-derives from what the server
      // actually stored, rather than from what was typed at it.
      setEdits(null);
      refreshNow();
    } catch (err) {
      // DRF's field names survive api.js's describeError, so a rejected radius
      // says which field it was rather than a bare "Request failed".
      setSaveError(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  /* Fills the form with the deployment's own defaults but does not save them:
     resetting a threshold is still a change to how duplicates are flagged, and
     it should go through the same Save (and the same audit entry) as any
     other. */
  function handleReset() {
    if (data?.defaults) {
      setEdits({
        duplicate_radius_m: data.defaults.duplicate_radius_m,
        duplicate_window_minutes: data.defaults.duplicate_window_minutes,
        map_recent_hours: data.defaults.map_recent_hours,
      });
    }
  }

  const limits = data?.limits;
  const hourChoices = limits?.map_recent_hours?.choices ?? [1, 6, 24];

  return (
    <BfpShell live={live} lastRefresh={lastRefresh} refreshNow={refreshNow}>
      <h1 className="bfp-page-title">Settings</h1>

      {error && <p className="bfp-inline-error">{error}</p>}

      <form onSubmit={handleSave}>
        <section className="bfp-panel">
          <div className="bfp-panel-head">
            <h2 className="bfp-panel-title">Duplicate detection</h2>
            <span className="bfp-panel-sub">
              Both conditions must hold before a report is flagged
            </span>
          </div>
          <div className="bfp-setting-list">
            <Field
              label="Match radius"
              hint={
                limits
                  ? `Between ${limits.duplicate_radius_m.min} and ${limits.duplicate_radius_m.max} metres`
                  : 'Two reports closer than this may be flagged'
              }
            >
              <input
                type="number"
                className="bfp-filter-select"
                min={limits?.duplicate_radius_m.min ?? 25}
                max={limits?.duplicate_radius_m.max ?? 2000}
                step={25}
                disabled={!form}
                value={form?.duplicate_radius_m ?? ''}
                onChange={(event) => set('duplicate_radius_m', Number(event.target.value))}
              />
              <span className="bfp-setting-unit">m</span>
            </Field>

            <Field
              label="Time window"
              hint={
                limits
                  ? `Between ${limits.duplicate_window_minutes.min} and ${limits.duplicate_window_minutes.max} minutes`
                  : 'Reports further apart than this are never flagged'
              }
            >
              <input
                type="number"
                className="bfp-filter-select"
                min={limits?.duplicate_window_minutes.min ?? 5}
                max={limits?.duplicate_window_minutes.max ?? 720}
                step={5}
                disabled={!form}
                value={form?.duplicate_window_minutes ?? ''}
                onChange={(event) =>
                  set('duplicate_window_minutes', Number(event.target.value))
                }
              />
              <span className="bfp-setting-unit">min</span>
            </Field>
          </div>
          <p className="bfp-panel-foot">
            Flagging is advisory. Nothing is merged or deleted, and a report a
            person has already ruled on is never re-flagged.
          </p>
        </section>

        <section className="bfp-panel">
          <div className="bfp-panel-head">
            <h2 className="bfp-panel-title">Dashboard</h2>
          </div>
          <div className="bfp-setting-list">
            <Field
              label="Live map window"
              hint="How far back the recent map reaches. Verified and Responding records stay on it regardless of age."
            >
              <select
                className="bfp-filter-select"
                disabled={!form}
                value={form?.map_recent_hours ?? ''}
                onChange={(event) => set('map_recent_hours', Number(event.target.value))}
              >
                {hourChoices.map((hours) => (
                  <option key={hours} value={hours}>
                    Last {hours} hour{hours === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <div className="bfp-settings-actions">
          <button
            type="button"
            className="bfp-link-btn"
            onClick={handleReset}
            disabled={!data}
          >
            Reset to defaults
          </button>
          <div className="bfp-settings-save">
            {saved && <span className="bfp-settings-saved">{saved}</span>}
            {saveError && <span className="bfp-inline-error">{saveError}</span>}
            {data?.updated_at && !saved && !saveError && (
              <span className="bfp-panel-sub">
                Last changed {new Date(data.updated_at).toLocaleString()}
                {data.updated_by_name ? ` by ${data.updated_by_name}` : ''}
              </span>
            )}
            <button
              type="submit"
              className="bfp-btn-primary"
              disabled={saving || !form || loading}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">This browser</h2>
          <span className="bfp-panel-sub">Not shared with other operators</span>
        </div>
        <div className="bfp-setting-list">
          <Field label="Theme" hint={`Currently showing ${theme}`}>
            <select
              className="bfp-filter-select"
              value={preference ?? 'system'}
              onChange={(event) =>
                setTheme(event.target.value === 'system' ? null : event.target.value)
              }
            >
              <option value="system">Match device</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
        </div>
      </section>
    </BfpShell>
  );
}

export default BfpSettings;
