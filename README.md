# FireTrace

Accounts - BFP + Civilian user auth
Incidents - Incident/Report Models, duplicate detection
Realtime  - Live dashboard push over Channels/WebSocket (`/ws/dashboard`)
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

## Reporting a fire (civilian)

Three steps, and the third one files it:

| Step | Route | What it collects |
|---|---|---|
| 1 of 3 | `/report` | Incident type + description |
| 2 of 3 | `/continue2` | Map pin or device GPS; barangay and address are reverse-geocoded from the pin and stay editable |
| 3 of 3 | `/continuethird` | Optional photograph, then **Submit Report** |

The receipt at `/continue4` shows the reference number and status. It is not a
step and submits nothing — refreshing it cannot file a second copy of the same
fire, and reaching it directly redirects to `/myreport`.

Each step gates its own Continue button, so a missing field is caught on the step
that owns it rather than surfacing as an unattributed validation error at submit
time. The photograph is genuinely optional; a report with no photo submits fine.

## BFP Administrative Portal

Sign in with a BFP account and you land on `/bfp`. Civilians who reach that URL
are redirected; the API enforces the same rule independently. The portal has two
screens, sharing one header and access check:

**`/bfp` — Overview.** What is happening now.

| Panel | What it shows |
|---|---|
| KPI cards | New Reports, Under Review, Duplicates (reports) · Responding, Resolved (incidents). Each card labels which record type it counts. |
| Live incident map | Google Maps, **recent scope only**. Red = verified incident, amber = unverified report, violet = possible duplicate. Only High/Medium geocoding confidence is plotted; the withheld Low count is shown in the legend. |
| System health | Application server, database and mapping service, each labelled `live` (actually probed) or `config` (configuration inspected). Also reports whether updates arrive by websocket or polling. |
| Recent activity | Personnel actions from `AUDIT_LOG`, plus system-raised entries from `INCIDENT_TIMELINE_EVENT`. |

**`/bfp/reports` — All Reports.** The archive: an all-time map plus the full
queue — reference, submitted time, barangay, category, photo availability,
workflow status, duplicate review, filterable and paginated. Flagged rows expose
the Keep Separate / Confirm Duplicate ruling inline.

### What the live map draws

The Overview map answers "what is burning now", not "what has ever been
reported". A record is drawn when it was created inside the selected window
**or** it is in an ongoing state (Verified / Responding) — a fire someone is
actively working stays on the map however old the report is, while one still
sitting in Submitted ages out. The window is switchable in the panel header
(1h / 6h / 24h, default 1h) and the subtitle always names the slice, so an empty
map can never be mistaken for a filtered one. Everything else is on
`/bfp/reports`.

A newly arrived report **pulses a red ring for 90 seconds** and the camera pans
to it at street level. Auto-focus only fires for a report it has not focused
before, so it never fights an operator who has panned away, and it never zooms
out.

### Real-time

Updates are pushed, not polled. Every view that mutates a record calls
`broadcast_dashboard_event`, which does a Channels `group_send`;
`realtime/consumers.py` relays it to each connected operator over
`/ws/dashboard`. **The push carries no incident data** — it means "refetch now",
and the browser goes back through the REST endpoints, so permissions and read
scoping stay in one place.

The socket authenticates with its first message rather than a query parameter,
so no token ends up in a URL, server log or browser history. The 15-second timer
survives as a fallback (60s once the socket is live), so a missed push means a
stale minute rather than a frozen screen. The header reads **Live** with a green
pulse only while the socket is genuinely connected, **Polling** otherwise.

`CHANNEL_LAYERS` uses Channels' in-memory layer, which needs no Redis but only
reaches clients attached to the same process — correct for `runserver`, not for a
multi-worker deployment. `settings.py` carries the Redis swap in a comment.

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
/api/dashboard/map/?scope=all             every record, any age (All Reports page)
/api/dashboard/map/?hours=1|6|24          live window; clamped to these values
/ws/dashboard                             websocket push, BFP only
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
- **Node.js 22 LTS** + npm (24.x is what is actually installed here and works)

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
| `channels` | ASGI/WebSocket layer behind the live dashboard |
| `channels-redis` | Redis channel layer — installed, not used; see `CHANNEL_LAYERS` |
| `daphne` | ASGI server; must be first in `INSTALLED_APPS` so `runserver` speaks WebSocket |
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
| `react-router-dom` | Client-side routing (civilian pages, report wizard, `/bfp`, `/bfp/reports`) |
| `@vis.gl/react-google-maps` | Google Maps components — the location picker and both dashboard maps |
| `vite` *(dev)* | Dev server + build tool |
| `@vitejs/plugin-react` *(dev)* | React support for Vite |
| `eslint` + plugins *(dev)* | Linting |

Install with:
```
cd "FireTrace BackEnd/FireTraceReact"
npm install
```

### Environment setup

There are **two** `.env` files.

Backend — repo root, `FireTrace BackEnd/.env` (copy `.env.example`):
```
DB_NAME=firetrace_db
DB_USER=postgres
DB_PASSWORD=...
DB_HOST=localhost
DB_PORT=5432
GOOGLE_MAPS_API_KEY=...
```

Frontend — `FireTraceReact/.env`:
```
VITE_API_BASE_URL=http://127.0.0.1:8000    # or http://<your-lan-ip>:8000 for a phone
VITE_GOOGLE_MAPS_API_KEY=...
VITE_GOOGLE_MAPS_MAP_ID=                   # optional; blank falls back to a literal id
```

Use `127.0.0.1`, **not** `localhost`. `runserver 0.0.0.0` binds IPv4 only, while
Chrome on Windows tries `::1` first and the connection is refused before Django
sees it — the page still loads, so it presents as "the API is down". Vite reads
`.env` only at startup, so restart it after any change.

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

It should print **`Starting ASGI/Daphne version 4.x`**. If it prints the old WSGI
line instead, `daphne` is missing from `INSTALLED_APPS` and the dashboard will
silently fall back to polling rather than live push.

**3. Frontend** (from `FireTrace BackEnd/FireTraceReact/`):
```
npm run dev              # local only — http://localhost:5173
npm run dev -- --host    # also exposes it on your LAN IP, e.g. http://192.168.1.22:5173
```

**4. Open the app** — go to the URL Vite prints (not the backend's `:8000` URL). That's the actual FireTrace UI:
- `/` — Welcome page (also pings the backend to confirm it's reachable)
- `/create` — register an account
- `/login` — log in (returns JWT tokens, stored in the browser)
- `/dashboard` — the civilian home
- `/report` → `/continue2` → `/continuethird` — the three-step report wizard; step 3
  files the report and hands you a receipt with the reference number
- `/myreport` — your own submissions
- `/bfp`, `/bfp/reports` — the BFP portal (personnel accounts only)

### Testing from a phone

Your phone must be on the **same Wi-Fi network** as your PC.

1. Find your PC's LAN IP (`ipconfig`, IPv4 address of the active adapter).
2. Set `VITE_API_BASE_URL=http://<your-lan-ip>:8000` in `FireTraceReact/.env` and
   restart Vite. This is the only place the IP has to be written down.
3. Run backend with `0.0.0.0:8000` and frontend with `-- --host`, per above.
4. On your phone's browser, visit `http://<your-pc-ip>:5173`.

`ALLOWED_HOSTS` and CORS need no editing: while `DEBUG` is on, `settings.py`
resolves this machine's own LAN addresses and trusts them, and CORS already
matches `192.168.*` / `10.*` origins by regex. Tunnel hosts
(`*.trycloudflare.com`, `*.ngrok-free.app`) are matched too.

**If the phone says it cannot reach the server**, check in this order: is
`VITE_API_BASE_URL` the LAN IP rather than `127.0.0.1` (which on the phone means
the phone itself); was Vite restarted after editing `.env`; is the backend bound
to `0.0.0.0`. A rejected hostname returns a bare `400` with no CORS headers,
which the browser reports as a network failure rather than as a server error.

### Creating a BFP account

Public registration (`/create`) creates a `civilian` account. To promote an existing account to BFP:
```
cd "FireTrace BackEnd/FireTrace"
python manage.py shell -c "from accounts.models import User; u = User.objects.get(username='the-email-they-registered-with'); u.user_type='bfp'; u.save()"
```
Then log in again on `/login` to see the BFP dashboard view.

> **Known gap:** `RegisterSerializer` currently exposes `user_type` as a writable
> field, so a request made directly to `POST /accounts/register` can ask for
> `"bfp"` and be granted it. "Registration always creates civilians" is true of
> the form, not of the API. Close this before any deployment.

Sign-in is case-insensitive: the username *is* the email, and both registration
and login fold it to lowercase, so a phone keyboard capitalising the first letter
cannot lock someone out.
