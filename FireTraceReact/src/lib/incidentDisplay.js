// Prefer the human label the API sends (`status_display` / `incident_type_display`,
// derived from the model's choices), falling back to a readable version of the
// raw value so the UI never shows something like "under_review".
export function humanize(displayValue, rawValue) {
  if (displayValue) return displayValue;
  return String(rawValue ?? '').replace(/[\s_]+/g, ' ');
}
