# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Geolocation-based fire incident reporting for BFP Calapan. Django REST backend
(`FireTrace/`) + React/Vite frontend (`FireTraceReact/`). Both must run at once.

`README.md` has the setup, env vars and full API surface — read it for anything
operational. This file covers architecture and what is **not** done.

## Commands

```
# backend (from FireTrace/)
python manage.py runserver 0.0.0.0:8000     # 0.0.0.0 needed for LAN/phone testing
python manage.py migrate
python manage.py test                        # 23 tests, all in incidents/tests.py
python manage.py test incidents.tests.DuplicateFlaggingTests.test_name   # single test
python manage.py seed_demo_data [--reset]    # bfp@firetrace.test / firetrace123, then /bfp

# frontend (from FireTraceReact/)
npm run dev -- --host                        # --host exposes on LAN
npm run lint && npm run build
```

`.env` lives at the repo root (`FireTrace BackEnd/.env`), not inside `FireTrace/`;
`settings.py` reads `BASE_DIR.parent / '.env'`. The frontend has its own
`FireTraceReact/.env` for `VITE_API_BASE_URL` and `VITE_GOOGLE_MAPS_*`.

Promote a civilian account to BFP (public registration always creates civilians):

```
python manage.py shell -c "from accounts.models import User; u=User.objects.get(username='email'); u.user_type='bfp'; u.save()"
```

---

## Architecture

### Django apps

| App | Role |
|---|---|
| `accounts` | Custom `User` (`AbstractUser` + `user_type` bfp/civilian), JWT auth, `IsBFPPersonnel` |
| `incidents` | Both record types, duplicate rule, geocoding grading, all report/incident/map views |
| `analytics` | `AuditLog` model + KPI / activity / health dashboard views |
| `realtime` | `notify.broadcast_dashboard_event` → Channels `group_send`; `consumers.DashboardConsumer` serves `/ws/dashboard` |

Routes: `/accounts/` auth · `/api/reports/` · `/api/incidents/` · `/api/dashboard/`
(kpis, map, activity, health — `map/` is `incidents.views.DashboardMapView`, routed
under analytics on purpose) · `/incidents/` deprecated alias for `/api/reports/`.

### The two record types are the whole design

`IncidentReport` = one civilian submission, kept verbatim, never merged or deleted.
`Incident` = the canonical event, created **only** by a person via
`POST /api/incidents/verify/` with `report_ids`. Reports link to an incident via
`report.incident`; linking changes nothing else about the report.

**Two independent status dimensions.** `workflow_status` (Submitted → Under Review →
Verified → Responding → Resolved) and `duplicate_status` (Not Flagged / Possible /
Kept Separate / Confirmed) live on separate fields, are moved by separate endpoints,
and every combination is legal. Never derive one from the other.

**Duplicates are flagged, never merged.** `incidents/duplicates.py` flags a report as
`POSSIBLE` only when both `DUPLICATE_RADIUS_METERS` (Haversine, default 150) **and**
`DUPLICATE_TIME_WINDOW_MINUTES` (default 30) hold. The distance and time delta that
triggered it are stored on the report so the reasoning is inspectable. Only a person
moves it to Kept Separate / Confirmed; a report already ruled on is never re-flagged.

**Confidence is graded server-side** in `incidents/geocoding.py` from
`location_source` + `gps_accuracy_m` — a client cannot assert its own confidence
(there is a test for that). Only High/Medium are plotted on the map; Low is kept and
reviewable but withheld from the map, with the withheld count shown in the legend.

**Analytics are descriptive only.** Counts, trends, observed response times. No
forecasting, no risk scoring, no automated dispatch.

### Write path

Every personnel mutation goes through `incidents/services.record_activity(...)`,
which writes an `IncidentTimelineEvent` *and* an `AuditLog` row in one call. The two
vocabularies differ deliberately: the timeline is the history of an incident, the
audit log is the history of personnel activity. Then the view calls
`broadcast_dashboard_event(...)`. Follow that order in any new mutating view.

Read scoping is centralised in `ReportQuerysetMixin` — civilians see only their own
reports. Everything under `/api/dashboard/` and every queue/incident view uses
`IsBFPPersonnel`.

### Frontend

Single Vite SPA, routes in `src/App.jsx`, wrapped in `ThemeProvider` +
`ReportDraftProvider`. Two shells share one app:

- **Civilian**, a phone column — `#root` is capped at `480px` in `index.css`.
- **BFP portal** at `/bfp` — `BfpDashboard` sets `document.body.dataset.shell='bfp'`
  on mount and removes it on unmount; `styles/bfp-dashboard.css` keys off
  `body[data-shell='bfp']` to escape the 480px cap.

`src/api.js` — `apiFetch` hardcodes `Content-Type: application/json`, attaches the
bearer token, and on a 401 refreshes once through a **shared** promise so parallel
401s trigger one refresh. `src/auth.js` picks `localStorage` (remember me, paired
with a 30-day refresh token) vs `sessionStorage`; reads check both.

The report wizard (`pages/report-wizard/`, routes `/report` → `/continue2` →
`/continuethird` → `/continue4`) accumulates one draft in `ReportDraftContext`,
persisted to `sessionStorage`, and posts it once at the confirmation step.

`pages/bfp/useDashboardData.js` — one clock drives every panel so they all show
the same moment. The clock is a WebSocket to `/ws/dashboard`; a push carries no
data, it only means "refetch now", so the REST endpoints stay the only thing
that reads and scopes the database. The timer survives as a fallback: 15s while
the socket is down, 60s once it is live. It pauses on a hidden tab and refreshes
on return; the socket stays open.

---

## Unfinished work

**The BFP dashboard has never been opened in a browser.** Builds and lints clean,
API covered by tests, but grid layout, marker drawing, InfoWindows, polling and dark
mode on the new panels are all unverified.

*Most likely failure point — Map ID.* `DashboardMap.jsx` reads
`VITE_GOOGLE_MAPS_MAP_ID`, while `IncidentMap.jsx` and `LocationPickerMap.jsx` pass
literal strings. `AdvancedMarker` needs a **real Map ID from Google Cloud Console**;
with an arbitrary string the map renders but markers silently don't. Check this first
if the map looks empty.

**No UI to create a canonical `Incident`** — the biggest functional hole. The API is
complete but the queue has no row selection and nothing calls
`POST /api/incidents/verify/`. Consequence: the Responding and Resolved KPI cards
read 0 forever in real use, since only `seed_demo_data` or the admin creates any.

**Photo capture is a stub.** `report-wizard/PhotoStep.jsx` buttons do nothing. The
backend accepts `photo` on `POST /api/reports/` and the queue's Photo column works,
but real submissions always show "no photo". Uploading needs `multipart/form-data`,
so `apiFetch` needs a path that doesn't force a JSON content type.

**Timeline endpoints are unused.** `/api/reports/<id>/timeline/` and
`/api/incidents/<id>/timeline/` are built and tested; no screen consumes them, and
clicking a queue row does nothing.

**Civilian app still on the legacy path.** It posts to `/incidents/`
(`incidents/legacy_urls.py`) and reads `report.status`, a read-only serializer alias
for `workflow_status`. Both can be deleted once the civilian pages move over.

### Testing gaps
No frontend tests. `analytics/tests.py`, `realtime/tests.py`, `accounts/tests.py`
are empty — KPI/activity/health views are only covered indirectly.

### Known small issues
- `Dashboard.jsx` reads `user.first_name`, which `UserSerializer` never returns —
  always `undefined`, falls back to `username`.
- Two pre-existing ESLint errors: unused `err` in `ForgotPasswordRequest.jsx` and
  `ForgotPasswordReset.jsx`.
- `SECRET_KEY` hardcoded in `settings.py`, `DEBUG = True`.
- Email backend is console-only, so password reset mails print to the terminal.
- `django-filter` is installed and in the `Pipfile` but never imported — queue
  filtering is hand-written in `ReportQueueView.get_queryset`. Use it or drop it.

---

## Dependencies NOT installed

Nothing below is needed for current code to run.

- **Redis** — only for a multi-process deployment. `CHANNEL_LAYERS` uses
  `InMemoryChannelLayer`, which needs no server but only reaches clients on the
  same process (fine for `runserver`). `channels-redis` is installed; swap the
  backend per the comment in `settings.py` when there is a Redis to point at.
  Nothing on this machine can run one today — no Docker, and `wsl` is a stub.
- **Pillow** — only if `IncidentReport.photo` switches `FileField` → `ImageField`.
  It is a `FileField` specifically to avoid the dependency; the Pillow wheel on
  Python 3.14 is untested.
- **Frontend: nothing.** The dashboard uses only what is already in `package.json`.

### Installed vs. thesis-specified versions — unresolved

| Component | Thesis spec | Installed |
|---|---|---|
| Python | 3.12 | 3.14.6 (`Pipfile` pins 3.14) |
| Django / DRF | 5.2 / 3.16 | 6.1 / 3.18 |
| Node / PostgreSQL | 22 LTS / 17 | 24.16 / 18.6 |
| React | 19 | 19.2.8 ✓ |
| Channels / Redis | 4.2 / 7.2 | 4.3.2 + daphne 4.2.3 / no Redis (in-memory layer) |

Downgrading Python or Postgres means rebuilding the virtualenv and the database.

---

## Gotchas

- **Model renames need hand-written migrations.** `0002` renames `Incident` →
  `IncidentReport`; left alone, `makemigrations` emits DeleteModel + CreateModel and
  drops every row.
- Bash heredocs (`<<'EOF'`) into files fail on CRLF here — use the Write tool for
  multi-line source files.
- `manage.py shell < script.py` swallows output; use `shell -c "$(cat script.py)"`.
- Uploaded photos land in `MEDIA_ROOT` and are **not** rolled back by a transaction —
  clean `FireTrace/media/` after a rolled-back seed run.
- Phone testing: the LAN IP must match `VITE_API_BASE_URL`, `ALLOWED_HOSTS` and
  `CORS_ALLOWED_ORIGINS`. Tunnel hosts (`*.trycloudflare.com`, `*.ngrok-free.app`)
  are already allowed by regex in `settings.py`.
