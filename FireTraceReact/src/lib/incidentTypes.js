/* The four incident types, mirroring `IncidentType` in incidents/models.py.

   One copy on the client. The reporter's form and the station's intake form
   have to offer the same list -- a type on one and not the other files reports
   the queue filter and the analytics grouping cannot account for -- and they
   were two literal lists with nothing holding them together. */

export const INCIDENT_TYPES = [
  { value: 'fire', label: 'Residential Fire' },
  { value: 'vehicle', label: 'Vehicle Fire' },
  { value: 'electrical', label: 'Electrical Fire' },
  { value: 'other', label: 'Other' },
];
