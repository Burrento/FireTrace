# FireTrace

Accounts - BFP + Civilian user auth
Incidents - Incident/Report Models, duplicate detection
Dispatch - Real-time updates via Channels/WebSocket
Analytics - Descriptive operational intelligence module

## Domain rules

These four rules constrain the data model, and the code is written to make
breaking them awkward. Tests in `incidents/tests.py` cover each one.

**1. A report is not an incident.** `IncidentReport` is one civilian
submission. `Incident` is the canonical event, and only exists because a person
verified it. Several reports can evidence one incident; every report is kept
verbatim regardless.

**2. Workflow status and duplicate status are separate dimensions.** A report
carries `workflow_status` (Submitted / Under Review / Verified / Responding /
Resolved) *and* `duplicate_status` (Not Flagged / Possible Duplicate / Kept
Separate / Confirmed Duplicate). Neither is derived from the other, they are
updated through different endpoints, and every combination is legal.

**3. Duplicates are flagged, never merged.** Two reports are flagged as
possible duplicates when they are within `DUPLICATE_RADIUS_METERS` (Haversine)
**and** `DUPLICATE_TIME_WINDOW_MINUTES` of each other — both conditions, or no
flag. The distance and time difference that triggered it are stored on the
report and shown in the queue, so personnel can see the reasoning. The system
never merges or deletes a report; only a person can rule on the flag, and only
to "Kept Separate" or "Confirmed Duplicate".

**4. Analytics are descriptive only.** Counts, trends, and observed response
times. No forecasting, no risk scoring, no automated resource allocation.

## BFP Administrative Portal

Sign in with a BFP account and you land on `/bfp`. Civilians who reach that URL
are redirected; the API enforces the same rule independently.

| Panel | What it shows |
|---|---|
| KPI cards | New Reports, Under Review, Duplicates (reports) · Responding, Resolved (incidents). Each card labels which record type it counts. |
| Incoming Reports queue | Reference, submitted time, barangay, category, photo availability, workflow status, duplicate review — filterable and paginated. Flagged rows expose the Keep Separate / Confirm Duplicate ruling inline. |
| Live incident map | Google Maps. Red = verified incident, amber = unverified report, violet = possible duplicate. Only High/Medium geocoding confidence is plotted; the withheld Low count is shown in the legend. |
| System health | Application server, database and mapping service, each labelled `live` (actually probed) or `config` (configuration inspected). |
| Recent activity | Personnel actions from `AUDIT_LOG`, plus system-raised entries from `INCIDENT_TIMELINE_EVENT`. |

The dashboard polls every 15 seconds and pauses while the tab is hidden.
Swapping in Channels/WebSockets is a change to `realtime/notify.py` and
`useDashboardData.js` only — every view that mutates a record already calls
`broadcast_dashboard_event`.

### Geocoding confidence

Graded server-side from how the coordinate was captured, so a client cannot
assert its own confidence:

| Capture method | Grade |
|---|---|
| Pin placed/dragged on the map | High |
| Device GPS, accuracy ≤ `GEO_HIGH_ACCURACY_M` (50 m) | High |
| Device GPS, accuracy ≤ `GEO_MEDIUM_ACCURACY_M` (200 m), or a geocoded address | Medium |
| Barangay only, or GPS accuracy beyond 200 m | Low — kept and reviewable, but not mapped |

### API surface

```
/api/reports/                             list + create civilian submissions
/api/reports/queue/                       filterable, paginated dashboard queue
/api/reports/<id>/status/                 move along the workflow dimension
/api/reports/<id>/duplicate-review/       record a manual duplicate ruling
/api/reports/<id>/timeline/               history of one report
/api/incidents/                           canonical incidents (BFP only)
/api/incidents/verify/                    create an incident from report(s)
/api/incidents/<id>/status/               dispatch / resolve
/api/dashboard/kpis|map|activity|health/  dashboard panels
/incidents/                               deprecated alias for /api/reports/
```

`/incidents/` still serves reports, and still exposes the `status` key, so the
shipped civilian app keeps working. New clients should use `/api/reports/`.

### Demo data

```
cd "FireTrace BackEnd/FireTrace"
python manage.py seed_demo_data              # add to whatever is there
python manage.py seed_demo_data --reset      # wipe incident data first
```

Seeds reports across Calapan barangays, including deliberate clusters that trip
the duplicate rule, a few low-confidence locations the map withholds, and some
verified incidents. Creates `bfp@firetrace.test` and civilian accounts, all with
password `firetrace123`.

## Dependencies & How to Run

FireTrace has two parts that both need to be running at once for the app to work: a Django backend (`FireTrace/`) and a React frontend (`FireTraceReact/`).

### Prerequisites

- **Python 3.14** (pinned in `Pipfile`)
- **pipenv**
- **PostgreSQL** (running locally, or reachable at the host/port in your `.env`)
- **Node.js 22 LTS** + npm

### Backend dependencies (`Pipfile`)

| Package | Purpose |
|---|---|
| `django` | Web framework |
| `djangorestframework` | REST API layer |
| `djangorestframework-simplejwt` | JWT auth (login/refresh tokens) |
| `django-cors-headers` | Allows the React frontend (different origin) to call the API |
| `django-filter` | Queryset filtering for DRF views |
| `django-environ` | Reads config (DB credentials, etc.) from `.env` |
| `psycopg[binary]` | PostgreSQL driver |
| `markdown` | Renders DRF's browsable API docs |
| `django-stubs` *(dev only)* | Type stubs for Django, used by Pyright/Pyrefly |

Install with:
```
cd "FireTrace BackEnd"
pipenv install
```

### Frontend dependencies (`FireTraceReact/package.json`)

| Package | Purpose |
|---|---|
| `react`, `react-dom` | UI framework |
| `react-router-dom` | Client-side routing (`/`, `/create`, `/login`, `/dashboard`) |
| `vite` *(dev)* | Dev server + build tool |
| `@vitejs/plugin-react` *(dev)* | React support for Vite |
| `eslint` + plugins *(dev)* | Linting |

Install with:
```
cd "FireTrace BackEnd/FireTraceReact"
npm install
```

### Environment setup

Copy `.env.example` to `.env` at the repo root (`FireTrace BackEnd/.env`) and fill in your Postgres credentials:
```
DB_NAME=firetrace_db
DB_USER=postgres
DB_PASSWORD=...
DB_HOST=localhost
DB_PORT=5432
```

### Running the project

**1. Database** — make sure PostgreSQL is running and the database from `.env` exists, then apply migrations:
```
cd "FireTrace BackEnd/FireTrace"
pipenv shell
python manage.py migrate
```

**2. Backend** (from `FireTrace BackEnd/FireTrace/`):
```
python manage.py runserver 0.0.0.0:8000
```
Binding to `0.0.0.0` (not just `127.0.0.1`) is required if you want to reach it from another device (e.g. your phone) on the LAN.

**3. Frontend** (from `FireTrace BackEnd/FireTraceReact/`):
```
npm run dev              # local only — http://localhost:5173
npm run dev -- --host    # also exposes it on your LAN IP, e.g. http://192.168.1.22:5173
```

**4. Open the app** — go to the URL Vite prints (not the backend's `:8000` URL). That's the actual FireTrace UI:
- `/` — Welcome page (also pings the backend to confirm it's reachable)
- `/create` — register an account
- `/login` — log in (returns JWT tokens, stored in the browser)
- `/dashboard` — shows "You are a BFP personnel" or "You are a Civilian" based on the logged-in user's role

### Testing from a phone

Your phone must be on the **same Wi-Fi network** as your PC.

1. Find your PC's LAN IP (`ipconfig`, look for the IPv4 address of your active Wi-Fi adapter).
2. Make sure that IP matches what's hardcoded in:
   - `FireTraceReact/src/api.js` (`API_BASE_URL`)
   - `FireTrace/FireTrace/settings.py` — `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` (needs both the backend's own origin and the frontend's `http://<ip>:5173` origin)
3. Run backend with `0.0.0.0:8000` and frontend with `-- --host`, per above.
4. On your phone's browser, visit `http://<your-pc-ip>:5173`.

If the IP changes (different network, router reassigns it, etc.), update all three places above and restart both servers.

### Creating a BFP account

Public registration (`/create`) always creates a `civilian` account by design — BFP accounts aren't self-service. To promote an existing account to BFP:
```
cd "FireTrace BackEnd/FireTrace"
python manage.py shell -c "from accounts.models import User; u = User.objects.get(username='the-email-they-registered-with'); u.user_type='bfp'; u.save()"
```
Then log in again on `/login` to see the BFP dashboard view.
