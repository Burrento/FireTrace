import { useCallback, useState } from 'react';
import { apiFetch } from '../../api';
import { INCIDENT_TYPES } from '../../lib/incidentTypes';
import LocationPickerMap from '../../components/LocationPickerMap';
import { roundCoord } from '../../lib/coords';
import BfpShell from './BfpShell';
import { useBfpPage } from './useDashboardData';

/* Manual intake: a fire reported to the station by hotline, walk-in, text,
   radio or referral, encoded so it joins the same queue, duplicate rule and map
   as app reports. The caller's name and number are recorded on the report; the
   account on it is the person who typed it in, and the encoding is audited. */

const CHANNELS = [
  { value: 'hotline', label: 'Hotline call' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'text', label: 'Text message' },
  { value: 'radio', label: 'Radio' },
  { value: 'referral', label: 'Inter-agency referral' },
];

const EMPTY = {
  source_channel: 'hotline',
  incident_type: '',
  caller_name: '',
  caller_phone: '',
  description: '',
  address: '',
  barangay: '',
  latitude: null,
  longitude: null,
};

function BfpIntake() {
  const { lastRefresh, refreshNow, live } = useBfpPage(60000);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);

  const update = (patch) => {
    setSaved(null);
    setForm((current) => ({ ...current, ...patch }));
  };

  const hasPin = form.latitude != null && form.longitude != null;
  const canSave = Boolean(form.incident_type) && hasPin && !saving;

  // Stable identity: the map calls this on every pin move. The address is only
  // filled when empty, so a landmark the caller gave is not overwritten.
  const handleResolveLocation = useCallback(({ status, barangay, address }) => {
    if (status === 'loading' || status === 'error') return;
    setForm((current) => ({
      ...current,
      barangay: barangay || '',
      address: current.address || address || '',
    }));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const report = await apiFetch('/api/reports/intake/', {
        method: 'POST',
        // The pin is placed by personnel from the caller's description.
        body: JSON.stringify({ ...form, location_confirmed: true, location_source: 'map_pin' }),
      });
      setSaved(report);
      setForm(EMPTY);
    } catch (err) {
      setError(err.message || 'Could not save the report.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BfpShell live={live} lastRefresh={lastRefresh} refreshNow={refreshNow}>
      <h1 className="bfp-page-title">Encode a Report</h1>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <div>
            <h2 className="bfp-panel-title">Report received outside the app</h2>
            <p className="bfp-panel-sub">
              It joins the same queue, duplicate check and map as app reports.
            </p>
          </div>
        </div>

        <form className="bfp-intake-form" onSubmit={handleSubmit}>
          <label>
            Source channel
            <select value={form.source_channel} onChange={(e) => update({ source_channel: e.target.value })}>
              {CHANNELS.map((channel) => (
                <option key={channel.value} value={channel.value}>{channel.label}</option>
              ))}
            </select>
          </label>

          <label>
            Incident type
            <select value={form.incident_type} onChange={(e) => update({ incident_type: e.target.value })} required>
              <option value="">Select incident type</option>
              {INCIDENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </label>

          <label>
            Caller name
            <input value={form.caller_name} maxLength={150} onChange={(e) => update({ caller_name: e.target.value })} />
          </label>

          <label>
            Caller contact number
            <input
              type="tel"
              value={form.caller_phone}
              maxLength={32}
              onChange={(e) => update({ caller_phone: e.target.value })}
            />
          </label>

          <label className="bfp-intake-wide">
            Description
            <textarea value={form.description} onChange={(e) => update({ description: e.target.value })} />
          </label>

          <label className="bfp-intake-wide">
            Address / landmark
            <input value={form.address} onChange={(e) => update({ address: e.target.value })} />
          </label>

          <div className="bfp-intake-wide">
            <span className="bfp-intake-label">Location (click the map to place the pin)</span>
            <div className="map-container">
              <LocationPickerMap
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={(lat, lng) => update({ latitude: roundCoord(lat), longitude: roundCoord(lng) })}
                onClear={() => update({ latitude: null, longitude: null, barangay: '' })}
                onResolveLocation={handleResolveLocation}
              />
            </div>
            <p className="bfp-panel-sub">
              {hasPin
                ? `Barangay: ${form.barangay || 'not detected'} · ${form.latitude}, ${form.longitude}`
                : 'No pin placed yet.'}
            </p>
          </div>

          {error && <p className="bfp-inline-error bfp-intake-wide">{error}</p>}
          {saved && (
            <p className="bfp-intake-saved bfp-intake-wide">
              Saved as {saved.reference_number}. It is now in the reports queue.
            </p>
          )}

          <div className="bfp-intake-wide">
            <button type="submit" className="bfp-intake-submit" disabled={!canSave}>
              {saving ? 'Saving…' : 'Save report'}
            </button>
          </div>
        </form>
      </section>
    </BfpShell>
  );
}

export default BfpIntake;
