/* The workflow dimension, shared by the queue and the map popup so both
   offer the same choices and colour them the same way. */

export const WORKFLOW_STATUSES = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'verified', label: 'Verified' },
  { value: 'responding', label: 'Responding' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
];

export function statusClass(value) {
  return `bfp-badge bfp-badge-${String(value).replace(/_/g, '-')}`;
}

/* The two ends of a fire's life. Both are read by the person who reported it,
   so both are confirmed before they are applied: resolving says the fire is
   out, and rejecting closes somebody's report and owes them a reason (which
   the API requires, so the dialog is not the only thing enforcing it). */
export const CONFIRMED_STATUSES = ['resolved', 'rejected'];
