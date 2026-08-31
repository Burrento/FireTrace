import { useEffect, useState } from 'react';
import BfpShell from './BfpShell';

/* Settings — FRONTEND ONLY.

   Nothing here talks to the API. Values start from DEFAULTS, are kept in
   component state, and (best-effort) mirrored to localStorage so a reload
   remembers them on this browser. "Save changes" just re-syncs that mirror
   and flashes a confirmation; wire it to a real endpoint later. */

const STORAGE_KEY = 'bfp-settings-draft';

const DEFAULTS = {
  duplicateRadius: 150,
  duplicateWindow: 30,
  mapWindow: 1,
  autoRefresh: true,
  soundAlerts: false,
  emailDigest: true,
  theme: 'system',
  mapProvider: 'google',
};

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="bfp-setting">
      <span className="bfp-setting-text">
        <span className="bfp-setting-label">{label}</span>
        {hint && <span className="bfp-setting-hint">{hint}</span>}
      </span>
      <span className={checked ? 'bfp-switch is-on' : 'bfp-switch'}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="bfp-switch-knob" />
      </span>
    </label>
  );
}

function BfpSettings() {
  const [form, setForm] = useState(loadDraft);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return undefined;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave(e) {
    e.preventDefault();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* private mode / storage disabled — ignore, this is a demo */
    }
    setSaved(true);
  }

  function handleReset() {
    setForm(DEFAULTS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <BfpShell>
      <h1 className="bfp-page-title">Settings</h1>

      <form onSubmit={handleSave}>
        <section className="bfp-panel">
          <div className="bfp-panel-head">
            <h2 className="bfp-panel-title">Duplicate detection</h2>
            <span className="bfp-panel-sub">Demo — not persisted server-side</span>
          </div>
          <div className="bfp-setting-list">
            <label className="bfp-setting">
              <span className="bfp-setting-text">
                <span className="bfp-setting-label">Match radius</span>
                <span className="bfp-setting-hint">Two reports closer than this may be flagged</span>
              </span>
              <span className="bfp-setting-control">
                <input
                  type="number"
                  className="bfp-filter-select"
                  min={25}
                  max={1000}
                  step={25}
                  value={form.duplicateRadius}
                  onChange={(e) => set('duplicateRadius', Number(e.target.value))}
                />
                <span className="bfp-setting-unit">m</span>
              </span>
            </label>
            <label className="bfp-setting">
              <span className="bfp-setting-text">
                <span className="bfp-setting-label">Time window</span>
                <span className="bfp-setting-hint">Both radius and window must hold</span>
              </span>
              <span className="bfp-setting-control">
                <input
                  type="number"
                  className="bfp-filter-select"
                  min={5}
                  max={180}
                  step={5}
                  value={form.duplicateWindow}
                  onChange={(e) => set('duplicateWindow', Number(e.target.value))}
                />
                <span className="bfp-setting-unit">min</span>
              </span>
            </label>
          </div>
        </section>

        <section className="bfp-panel">
          <div className="bfp-panel-head">
            <h2 className="bfp-panel-title">Dashboard</h2>
          </div>
          <div className="bfp-setting-list">
            <label className="bfp-setting">
              <span className="bfp-setting-text">
                <span className="bfp-setting-label">Live map window</span>
                <span className="bfp-setting-hint">How far back the recent map reaches</span>
              </span>
              <span className="bfp-setting-control">
                <select
                  className="bfp-filter-select"
                  value={form.mapWindow}
                  onChange={(e) => set('mapWindow', Number(e.target.value))}
                >
                  <option value={1}>Last 1 hour</option>
                  <option value={6}>Last 6 hours</option>
                  <option value={24}>Last 24 hours</option>
                </select>
              </span>
            </label>
            <label className="bfp-setting">
              <span className="bfp-setting-text">
                <span className="bfp-setting-label">Map provider</span>
              </span>
              <span className="bfp-setting-control">
                <select
                  className="bfp-filter-select"
                  value={form.mapProvider}
                  onChange={(e) => set('mapProvider', e.target.value)}
                >
                  <option value="google">Google Maps</option>
                  <option value="osm">OpenStreetMap</option>
                </select>
              </span>
            </label>
            <Toggle
              label="Auto-refresh"
              hint="Poll for new reports on a timer when live updates are down"
              checked={form.autoRefresh}
              onChange={(v) => set('autoRefresh', v)}
            />
            <Toggle
              label="Sound alert on new report"
              checked={form.soundAlerts}
              onChange={(v) => set('soundAlerts', v)}
            />
          </div>
        </section>

        <section className="bfp-panel">
          <div className="bfp-panel-head">
            <h2 className="bfp-panel-title">Preferences</h2>
          </div>
          <div className="bfp-setting-list">
            <label className="bfp-setting">
              <span className="bfp-setting-text">
                <span className="bfp-setting-label">Theme</span>
              </span>
              <span className="bfp-setting-control">
                <select
                  className="bfp-filter-select"
                  value={form.theme}
                  onChange={(e) => set('theme', e.target.value)}
                >
                  <option value="system">Match system</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </span>
            </label>
            <Toggle
              label="Weekly email digest"
              hint="Summary of reports and response times every Monday"
              checked={form.emailDigest}
              onChange={(v) => set('emailDigest', v)}
            />
          </div>
        </section>

        <div className="bfp-settings-actions">
          <button type="button" className="bfp-link-btn" onClick={handleReset}>
            Reset to defaults
          </button>
          <div className="bfp-settings-save">
            {saved && <span className="bfp-settings-saved">Saved on this browser</span>}
            <button type="submit" className="bfp-btn-primary">
              Save changes
            </button>
          </div>
        </div>
      </form>
    </BfpShell>
  );
}

export default BfpSettings;
