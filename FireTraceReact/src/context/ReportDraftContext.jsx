import { useState } from 'react';
import { ReportDraftContext } from './reportDraftContextObject';

const STORAGE_KEY = 'reportDraft';

const emptyDraft = {
  incident_type: '',
  description: '',
  barangay: '',
  address: '',
  latitude: null,
  longitude: null,
  location_confirmed: false,
};

function loadDraft() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? { ...emptyDraft, ...JSON.parse(stored) } : emptyDraft;
  } catch {
    return emptyDraft;
  }
}

export function ReportDraftProvider({ children }) {
  const [draft, setDraft] = useState(loadDraft);

  function updateDraft(patch) {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
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
