// Status values arrive from the API as snake_case (e.g. "under_review"), while
// the CSS modifier classes are kebab-case (.status-under-review) — normalise
// underscores as well as spaces so the badge actually picks up its colour.
export function statusClass(status) {
  return 'status-badge status-' + String(status).toLowerCase().replace(/[\s_]+/g, '-');
}

// Prefer the human label the API sends (`status_display` / `incident_type_display`,
// derived from the model's choices), falling back to a readable version of the
// raw value so the UI never shows something like "under_review".
export function humanize(displayValue, rawValue) {
  if (displayValue) return displayValue;
  return String(rawValue ?? '').replace(/[\s_]+/g, ' ');
}
