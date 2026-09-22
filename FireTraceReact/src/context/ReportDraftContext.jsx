import { useState } from 'react';
import { roundCoord } from '../lib/coords';
import { ReportDraftContext } from './reportDraftContextObject';

const STORAGE_KEY = 'reportDraft';

/* latitude/longitude are DecimalField(max_digits=9, decimal_places=6) on the
   server, so a raw Google Maps or Geolocation coordinate — which carries a
   dozen or more decimals — is rejected outright with "no more than 9 digits in
   total". Round on the way into the draft, once, so every writer is covered and
   the Lat/Lng the reporter is shown is exactly what gets filed.

   The rule itself lives in lib/coords.js, shared with the BFP intake form. */

function withRoundedCoords(patch) {
  const next = { ...patch };
  if ('latitude' in next) next.latitude = roundCoord(next.latitude);
  if ('longitude' in next) next.longitude = roundCoord(next.longitude);
  return next;
}

const emptyDraft = {
  incident_type: '',
  description: '',
  barangay: '',
  address: '',
  latitude: null,
  longitude: null,
  location_confirmed: false,
  /* How the coordinate was captured. The backend grades geocoding confidence
     from this (a pin the reporter placed beats a coarse GPS fix), and only
     high/medium confidence reports are plotted on the BFP map. */
  location_source: 'map_pin',
  gps_accuracy_m: null,
};

function loadDraft() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    // Rounded again on the way out: a draft saved before this fix shipped can
    // still be sitting in sessionStorage with full-precision coordinates.
    return stored ? { ...emptyDraft, ...withRoundedCoords(JSON.parse(stored)) } : emptyDraft;
  } catch {
    return emptyDraft;
  }
}

export function ReportDraftProvider({ children }) {
  const [draft, setDraft] = useState(loadDraft);

  function updateDraft(patch) {
    setDraft((prev) => {
      const next = { ...prev, ...withRoundedCoords(patch) };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function resetDraft() {
    sessionStorage.removeItem(STORAGE_KEY);
    setDraft(emptyDraft);
  }

  return (
    <ReportDraftContext.Provider value={{ draft, updateDraft, resetDraft }}>
      {children}
    </ReportDraftContext.Provider>
  );
}
