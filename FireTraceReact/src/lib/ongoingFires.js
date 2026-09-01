/* What "still burning" means on the client.

   The same two statuses the backend calls ONGOING_STATUSES: personnel have
   confirmed the fire is real and nobody has marked it Resolved yet. Every map
   in the app reads the rule from here, so the operations map, the archive map
   and the civilian live map can never disagree about which pins should be
   pulsing. */
const ONGOING_STATUSES = new Set(['verified', 'responding']);

export function isOngoing(record) {
  return ONGOING_STATUSES.has(String(record?.workflow_status));
}

/* Reports and incidents number themselves independently, so an id alone is not
   unique across a map that draws both. */
export function markerKey(record) {
  return `${record.kind}-${record.id}`;
}
