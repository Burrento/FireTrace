# Manuscript changes to make at turnover

What the capstone document says that the built system does not, and what to
write instead. Checked against the code on 2026-09-16.

## How to use

1. Work top to bottom once the system is finished.
2. **Update now** — true today; edit the document as written.
   **Recheck at turnover** — depends on work still in progress; confirm against
   the running system before editing.
3. Every row also goes into the Feature-Status Governance Register (Appendix U)
   as Implemented, Tested, Partially Implemented, Deferred, or Future Enhancement.

UI mockups, the ERD and the data dictionary are concept material and are not
tracked here.

---

## 1. Table 3.11 — Development Tools and Technologies

**Status:** Update now

| Component | Document says | Change to |
|---|---|---|
| Database | PostgreSQL 17 | PostgreSQL 18 (development); Azure Database for PostgreSQL (deployment) |
| Backend language | Python 3.12 | Python 3.14 |
| Backend framework | Django 5.2 | Django 6.0 |
| REST API | Django REST Framework 3.16 | Django REST Framework 3.18 |
| Real-time | Django Channels 4.2 | Django Channels 4.3 with Daphne 4.2 (ASGI server) |
| In-memory store | Redis 7.2 | Azure Managed Redis (deployment); in-memory channel layer (development) |
| Frontend | React 19 | React 19.2 |
| Frontend runtime | Node.js 22 LTS | Node.js 24 |

Add rows:

| Component | Technology | Purpose |
|---|---|---|
| Backend hosting | Azure Container Apps | Runs the Django/Daphne backend container |
| Frontend hosting | Azure Static Web Apps | Serves the React application |
| File storage | Azure Blob Storage | Stores optional report photographs behind expiring signed URLs |
| Continuous integration | GitHub Actions | Builds the backend image and deploys the frontend on every push |

---

## 2. Chapter III §M — System Architecture

**Status:** Update now

| Document says | Change to |
|---|---|
| "An Email Gateway is also integrated to deliver optional email notifications…" | Remove. Email notifications are a Future Enhancement; no email gateway is configured. |
| "…the Audit Logging and Backup Service, which … performs scheduled backups…" | "…records significant system activities and produces an on-demand, audited data export. Scheduled backups are performed by the managed database service (Azure)." |
| "…downloadable PDF or Excel reports." | "…downloadable CSV reports." (Recheck after the operational export is built — see §12.) |
| No deployment description | Add a paragraph: the backend runs as a container on Azure Container Apps, the frontend on Azure Static Web Apps, with Azure Database for PostgreSQL, Azure Managed Redis for the real-time channel layer, and Azure Blob Storage for photographs. |

Keep as written (matches the build): WebSocket notifications with REST polling
fallback; the socket authenticates on its first message; polling every 15 s
while the socket is down and every 60 s while it is live.

---

## 3. User roles

**Where:** Chapter I Scope, §S, Appendix A Feature 22, Table 3.7
**Status:** Update now

| Document says | Change to |
|---|---|
| Three roles: Civilian, BFP Personnel, System Administrator | Two application roles, Civilian and BFP Personnel, plus a separate administrator (staff) permission that grants the system administration site. Public registration always creates a Civilian; only an administrator can grant the BFP role. |

Alternative: keep three roles and mark a distinct System Administrator role
inside the portal as Deferred.

---

## 4. Backup and restoration

**Where:** Chapter I MVP table ("administrator-authorized backup and restoration"),
Limitation 12, FR-14, NFR-12, Appendix A Feature 26, Table 3.12 (Backup
restoration ≤ 30 minutes), Table 3.13 Backup row, §N Backup and Restoration Testing
**Status:** Update now

| Document says | Change to |
|---|---|
| Administrator creates and restores backups inside FireTrace | Administrators download a full JSON export of the operational data from the portal (audited, password hashes excluded). Restoration uses Azure Database for PostgreSQL point-in-time restore, performed by the administrator in Azure. An in-app restore is excluded on purpose: replacing a live database from an uploaded file is destructive and all-or-nothing. |
| Restoration test: restore the backup in the system and compare | Restore the database to a point in time on a new server, then compare record counts and sample records against the source. Record the duration against the 30-minute target. |

---

## 5. Historical records

**Where:** §L (whole section), historical parts of Tables 3.9 and 3.10, FR-11,
FR-12, FR-14 (import validation), Appendix A Features 18 and 20, Table 3.7
(HISTORICAL_INCIDENT)
**Status:** Recheck at turnover

No historical-record import or repository exists; it depends on the BFP
authorising release of the 2021–June 2026 records. Unless that data arrives and
the import is built, mark as **Conditional / Deferred** and state that the
descriptive analytics use current FireTrace records only.

---

## 6. Duplicate-rule version governance

**Where:** Appendix A Feature 24, FR-07, DUPLICATE_REVIEW `threshold_version`
**Status:** Update now

| Document says | Change to |
|---|---|
| Thresholds carry a version, approving authority, effective date, previous version, rollback, and the version used per comparison | The distance and time thresholds are editable at runtime by BFP personnel; every change is audit-logged with the old value, new value, and responsible user, and takes effect on the next report. Each flagged report stores the computed distance and time difference. Formal version numbers, approval records and rollback are not implemented (Partially Implemented). |

---

## 7. Reference data and configuration

**Where:** FR-13, NFR-08, Appendix A Feature 23
**Status:** Update now

| Document says | Change to |
|---|---|
| Administrators manage barangays, incident categories, status values, duplicate thresholds and notification settings | Configurable at runtime: duplicate distance, duplicate time window, and the live-map time window. Barangays, incident categories and status values are fixed in the source code under version control. The geocoding confidence bands are deliberately not editable at runtime, since changing them would re-grade past reports. |

---

## 8. Stored coordinates

**Where:** FR-03, Table 3.13 Geolocation row, Appendix A Feature 3
**Status:** Update now

| Document says | Change to |
|---|---|
| Original GPS coordinates and user-adjusted coordinates are stored separately | One final coordinate pair is stored with its location source (device GPS, map pin, geocoded address, barangay only) and the reported GPS accuracy, from which the server grades geocoding confidence. |

---

## 9. Report form fields

**Where:** FR-02, Appendix A Feature 2, Table 3.13 Structured Submission
**Status:** Update now

| Document says | Change to |
|---|---|
| Incident details, observable conditions, address or landmark, observed time, registered contact number, optional alternative contact | Incident category (required), map pin confirmed by the reporter (required), optional description, optional photograph. The barangay is detected automatically from the pin. The reporter's contact number comes from their account. Submission time is recorded by the server. Observed time, observable conditions, landmark, and a per-report alternative contact are not collected (Deferred). |

---

## 10. Deferred by team decision

**Status:** Update now (revisit if built later)

| Feature | Where | Change to |
|---|---|---|
| Workflow-transition enforcement | Feature 13, FR-08, Table 3.13 Status Workflow row ("Submitted-to-Resolved must fail") | Mark Deferred. Personnel may set any workflow status; every change is audit-logged with previous and new value. Remove or mark Deferred the "prohibited transitions fail" expectation. |
| Screen to create a canonical incident | Feature 12 | Mark Partially Implemented: the API that creates a canonical incident from selected reports exists and is tested; the portal has no screen for it yet. |
| Departure, Arrival and Fire Controlled timeline events; Average Response Time | FR-09, Features 14 and 20, Table 3.10 Average Response Time, Table 3.13 Response Timeline row | Mark Deferred. The timeline records submission, status changes, verification, dispatch, duplicate flags and reviews, and report linkage, with dispatch and resolution timestamps on the incident. Arrival time is not recorded, so arrival-based response time is not computed. |

---

## 11. Other wording

**Status:** Recheck at turnover

| Document says | Change to |
|---|---|
| "Civilian Progressive Web Application (PWA)" | Confirm a web app manifest and service worker exist. If not, "responsive web application". |
| FR-01 "password controls" | Signed-in users can change their password. Password reset by email is not functional (no reset endpoint or mail service) — Deferred. |
| OTP verification for contact-number changes | Not implemented; no SMS gateway — Future Enhancement. |
| Privacy Notice and Consent wording | Written from what the system actually stores; must be reviewed and approved by BFP-Calapan before the pilot. |

---

## 12. Work in progress — recheck when each lands

**Status:** Recheck at turnover

| Item | Document reference | Expected wording once built |
|---|---|---|
| ✅ Photo compression and file limits — **built 2026-09-16** | FR-04, Feature 4, Table 3.13 Photograph Upload | Photographs are resized (1600 px long edge) and compressed to JPEG on the device before upload. The server accepts JPEG, PNG or WebP up to 5 MB, identified by the file's content rather than its name, and rejects anything else. |
| ✅ Hotline on registration, report form and failure notice — **built 2026-09-16** | FR-01, Business Rule 9, Limitation 4 | As written. Login, registration and the report form show the hotline with a tap-to-call number and the statement that FireTrace does not dispatch; a failed submission says "Your report was not sent" with the same notice. |
| ✅ Consent at registration — **built 2026-09-16** | FR-01 | As written. Registration requires agreeing to the Privacy Notice and Consent to Data Use pages. |
| ✅ Registered contact number stored — **fixed 2026-09-16** | FR-02, §S Data Minimization | As written. (The mobile number was collected on the form but not saved until this fix.) |
| ✅ Sign-in audit logging — **built 2026-09-16** | Feature 25, §S | As written. Successful sign-ins are recorded with the account and time; failed attempts are not attributed to an account. |
| ✅ Linked report shows the canonical incident's status — **built 2026-09-16** | Limitation 6, Business Rule 6, FR-08 | As written. A reporter tracking a linked report sees the incident's status; personnel cannot change a linked report's status directly and are told to change the incident instead. |
| ✅ Rejected / false-alarm outcome — **built 2026-09-16** | FR-06, Feature 9, Table 3.10 | Personnel can mark a report Rejected (false alarm, hoax, not a fire). It is kept, leaves the New and Under Review counts and the live map, counts as reviewed, and the reporter sees a plain explanation. |
| ✅ Unlink and relink — **built 2026-09-16 (API only)** | Feature 12 | Personnel can move a report to another canonical incident or unlink it; each move records the user, time, previous and new incident, and an optional reason. There is no portal screen for it yet, because the incident-creation screen is deferred (§10). Mark Partially Implemented. |
| ✅ Manual intake with source channel — **built 2026-09-16** | FR-06, Feature 8 | "Encode a Report" in the portal records reports from hotline, walk-in, text, radio or inter-agency referral with the caller's name and number. They go through the same duplicate rule, queue and map, show the channel on the map, and the encoding is audit-logged. The queue cannot yet filter by source channel (Feature 16). |
| ✅ Civilian in-system notifications — **built 2026-09-16** | Feature 7, NFR-11 | The Alerts screen lists updates on the reporter's own reports (received, status changes, verified as part of an incident, and the linked incident's status changes). Messages never include staff notes. They load when the screen is opened; there is no real-time push to civilians. |
| ✅ Downloadable operational report — **built 2026-09-16** | FR-11, Feature 21, §M | The Operational Overview downloads as CSV (not PDF or Excel): rates with their counts, daily intake, category and barangay distributions, and response times for the selected period. The file is generated in the browser, so the download itself is not audit-logged. |
