# FireTrace — working notes

Geolocation-based fire incident reporting for BFP Calapan. Django REST backend
(`FireTrace/`) + React frontend (`FireTraceReact/`). Both must run at once.

Domain rules, API surface and setup live in `README.md` — read that first.
This file is the running list of **what is not done**, so a new session doesn't
have to rediscover it.

## Run

```
cd FireTrace       && python manage.py runserver 0.0.0.0:8000
cd FireTraceReact  && npm run dev -- --host
cd FireTrace       && python manage.py test          # 23 tests, all passing
cd FireTraceReact  && npm run lint && npm run build
```

Demo data: `python manage.py seed_demo_data [--reset]` → creates
`bfp@firetrace.test` / `firetrace123`, then open `/bfp`.

---

## Dependencies NOT installed

Nothing below is needed for the current code to run. They are required only for
the features listed as unfinished.

### Real-time (Channels/Redis) — needed to replace polling

```
pipenv install channels channels-redis daphne
```

| Package | Version in thesis spec | Status |
|---|---|---|
| `channels` | 4.2 | not installed |
| `channels-redis` | — | not installed |
| `daphne` | — | not installed (ASGI server) |
| **Redis server** | 7.2 | **not installed, not on PATH** |

Redis is a separate service, not a pip package. On Windows use Memurai, WSL2,
or Docker (`docker run -p 6379:6379 redis:7.2`).

### Photo uploads — only if switching `FileField` → `ImageField`

```
pipenv install pillow
```

`IncidentReport.photo` is currently a `FileField` specifically to avoid this
dependency. `ImageField` adds image validation and dimensions. Pillow on
Python 3.14 was untested — verify the wheel installs before committing to it.

### Frontend

**Nothing to install.** The dashboard uses only packages already in
`package.json` (`@vis.gl/react-google-maps`, `react-router-dom`). No new
frontend dependency was added.

### Dead dependency

`django-filter` is in the `Pipfile` and installed, but **never imported**
anywhere. Queue filtering is hand-written in `ReportQueueView.get_queryset`.
Either use it or drop it from the `Pipfile`.

---

## Installed vs. thesis-specified versions

The environment runs newer versions than the authorized stack. Everything
works; this matters only if the defense requires the exact pinned versions.
**Unresolved — needs a decision.**

| Component | Thesis spec | Actually installed |
|---|---|---|
| Python | 3.12 | 3.14.6 (`Pipfile` pins 3.14) |
| Django | 5.2 | 6.1 |
| Django REST Framework | 3.16 | 3.18.0 |
| Node.js | 22 LTS | 24.16.0 |
| PostgreSQL | 17 | 18.6 |
| React | 19 | 19.2.8 ✓ |
| Django Channels | 4.2 | not installed |
| Redis | 7.2 | not installed |

Downgrading Python/Postgres means rebuilding the virtualenv and the database.

---

## Unfinished work

### Never verified at runtime

**The BFP dashboard has never been opened in a browser.** It builds clean and
lints clean, and the API is covered by tests, but no one has seen it render.
Unverified: grid layout, Maps markers drawing, InfoWindows, the 15s polling,
dark mode on the new panels.

**Most likely failure point — Map ID.** `DashboardMap.jsx` reads
`VITE_GOOGLE_MAPS_MAP_ID`, while the older `IncidentMap.jsx` and
`LocationPickerMap.jsx` pass literal strings (`firetrace-incident-map`,
`firetrace-location-picker`). `AdvancedMarker` needs a **real Map ID
configured in Google Cloud Console**; with an arbitrary string the map renders
but markers silently do not appear. If the dashboard map looks empty, check
this first.

### Missing features

**No UI to create a canonical `Incident`.** The API is complete
(`POST /api/incidents/verify/` takes `report_ids`), but nothing in the
dashboard calls it — the queue has no row selection and no "verify selected"
action. Consequence: the **Responding and Resolved KPI cards read 0 forever**
in real use, because those count canonical incidents and only `seed_demo_data`
or the Django admin creates any. This is the biggest functional hole.

**Photo capture is a stub.** `pages/report-wizard/PhotoStep.jsx` has TAKE SAFE
PHOTO / SELECT FROM GALLERY buttons that do nothing — no file input, no
capture, no upload. The backend accepts `photo` on `POST /api/reports/` and the
queue's Photo column works, but real submissions will always show "no photo".
Note the report is submitted as JSON in `ConfirmationStep.jsx`; uploading a
file needs `multipart/form-data`, so `apiFetch` (which hardcodes
`Content-Type: application/json`) needs a path for that.

**Timeline endpoints are unused.** `/api/reports/<id>/timeline/` and
`/api/incidents/<id>/timeline/` are built and tested, but no frontend screen
consumes them. There is no report detail view or drawer in the dashboard —
clicking a queue row does nothing.

**Real-time is polling.** `realtime/notify.py` is a documented no-op.
Every mutating view already calls `broadcast_dashboard_event`, so switching to
Channels is a change to that file plus `useDashboardData.js` and nothing else.
Step-by-step instructions are in the module docstring.

**Civilian app still on the legacy path.** It posts to `/incidents/`, which is
an alias for `/api/reports/` (`incidents/legacy_urls.py`). The serializer also
exposes a read-only `status` alias for `workflow_status` because the shipped
app reads `report.status`. Both can be deleted once the civilian pages move to
`/api/reports/` and `workflow_status`.

### Testing gaps

- No frontend tests at all.
- `analytics/tests.py` and `realtime/tests.py` are empty stubs. The KPI,
  activity-feed and health views are only covered indirectly via
  `incidents/tests.py`.

### Known small issues

- `Dashboard.jsx` reads `user.first_name`, but `UserSerializer` doesn't return
  it — always `undefined`, silently falls back to `username`. Pre-existing.
- Two pre-existing ESLint errors: unused `err` in `ForgotPasswordRequest.jsx`
  and `ForgotPasswordReset.jsx`.
- `SECRET_KEY` is hardcoded in `settings.py` and `DEBUG = True`. Fine for dev,
  must change before any real deployment.
- Email backend is console-only (`MAILERS` in `settings.py`), so password
  reset mails only print to the terminal.

---

## Conventions and gotchas

**Two record types, kept apart.** `IncidentReport` = one civilian submission.
`Incident` = the canonical event, created only by a person. Never merge or
delete a report — the duplicate rule only ever *flags*.

**Two independent status dimensions.** `workflow_status` and
`duplicate_status` are separate fields with separate endpoints. Never derive
one from the other. Linking several reports to one incident is **not** a
duplicate ruling.

**Confidence is graded server-side** in `incidents/geocoding.py` from
`location_source` + `gps_accuracy_m`. A client cannot assert its own
confidence — there's a test for that.

**Model renames need hand-written migrations.** `0002` renames
`Incident` → `IncidentReport`; left to itself `makemigrations` emits
DeleteModel + CreateModel and drops every row.

**Layout escape hatch.** `#root` is capped at `480px` (phone column) in
`index.css`. `BfpDashboard` sets `document.body.dataset.shell = 'bfp'` on mount
and removes it on unmount; `bfp-dashboard.css` keys off
`body[data-shell='bfp']` to go full-width.

**Tooling on this machine (Git Bash on Windows):**
- Bash heredocs (`<<'EOF'`) into files fail on CRLF — use the Write tool for
  multi-line source files.
- `manage.py shell < script.py` swallows output. Use
  `manage.py shell -c "$(cat script.py)"`.
- Uploaded photos land in `MEDIA_ROOT` and are **not** rolled back by a
  transaction — clean up `FireTrace/media/` after any rolled-back seed run.
