/* CSV helpers shared by the portal's exports (Audit Log, Operational Overview). */

export function csvLine(values) {
  return values.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',');
}

export function downloadCsv(text, filename) {
  // The byte-order mark makes Excel read the file as UTF-8, so a barangay
  // name with an ñ does not arrive garbled.
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Object URLs live until revoked, so an operator exporting repeatedly would
  // otherwise leak a blob per download for the life of the tab.
  URL.revokeObjectURL(url);
}
