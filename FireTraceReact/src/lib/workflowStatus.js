/* The workflow dimension, shared by the queue and the map popup so both
   offer the same choices and colour them the same way. */

export const WORKFLOW_STATUSES = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'verified', label: 'Verified' },
  { value: 'responding', label: 'Responding' },
  { value: 'resolved', label: 'Resolved' },
];

export function statusClass(value) {
  return `bfp-badge bfp-badge-${String(value).replace(/_/g, '-')}`;
}
