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
| 3 of 3 | `/continuethird` | Optional photograph — camera or gallery — then **Submit Report** |

The receipt at `/continue4` shows the reference number and status. It is not a
step and submits nothing — refreshing it cannot file a second copy of the same
fire, and reaching it directly redirects to `/myreport`.

Each step gates its own Continue button, so a missing field is caught on the step
that owns it rather than surfacing as an unattributed validation error at submit
time. The photograph is genuinely optional; a report with no photo submits fine.

**Photographs.** *Take safe photo* opens the device camera, *Select from gallery*
opens the picker, and the chosen image previews with a Remove button. Anything
over 10 MB or not an image is refused on the spot. A report carrying a photo is
sent as `multipart/form-data` instead of JSON; one without is unchanged. Uploads
go to Azure Blob Storage in the deployment and to `MEDIA_ROOT` locally — see
[Photo storage](#photo-storage).

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

`CHANNEL_LAYERS` picks its backend from whether `REDIS_HOST` is set. Without it,
Channels' in-memory layer — no Redis needed, but it only reaches clients attached
to the same process, which is correct for `runserver` and wrong for a
multi-worker deployment. With it, the Redis layer, which is what the deployment
uses.

Two things about that Redis config are load-bearing and easy to undo by tidying:

- `address` must be a **URL string** (`rediss://host:port`). `channels-redis`
  passes a dict host straight to `ConnectionPool.from_url`, so a `(host, port)`
  tuple raises `'tuple' object has no attribute 'decode'` on the first
  `group_add` — which surfaces only as a 1011 close on the socket. TLS rides on
  the `rediss://` scheme; there is no `ssl` keyword here.
- `socket_timeout` must stay **above `channels-redis`'s `brpop_timeout` of 5s**.
  An idle consumer blocks in `bzpopmin(timeout=5)`, and with `socket_timeout`
  unset redis-py reuses that as the read deadline, giving up at exactly 5.000s
  while Azure replies at ~5.2s. The client loses that race every time: the read
  raises, the consumer dies, the browser reconnects, and the dashboard falls
  back to polling forever while looking merely quiet.

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
| `channels-redis` | Redis channel layer — used whenever `REDIS_HOST` is set, which is how the deployment runs |
| `django-storages[azure]` | Uploads to Azure Blob Storage when a storage account is configured |
| `whitenoise` | Serves `STATIC_ROOT` in the deployment (static only — never user uploads) |
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
DEBUG=True
DB_NAME=firetrace_db
DB_USER=postgres
DB_PASSWORD=...
DB_HOST=localhost
DB_PORT=5432
GOOGLE_MAPS_API_KEY=...
```

`DEBUG` defaults to **False** so a deployment that forgets to set it is safe
rather than sorry. Turn it on locally: it is what registers the `MEDIA_URL`
route that serves uploaded photographs back, and what auto-trusts this machine's
LAN addresses for phone testing. Without it a photo uploads fine and then 404s
when anything tries to display it.

Optional backend settings, all with working defaults:

| Variable | Default | Purpose |
|---|---|---|
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_SSL` | unset | Switches the channel layer to Redis. Azure Managed Redis is port **10000**, not 6379/6380 |
| `REDIS_SOCKET_TIMEOUT` | `30` | Must stay above `channels-redis`'s 5s `brpop_timeout` — see [Real-time](#real-time) |
| `AZURE_ACCOUNT_NAME` / `AZURE_ACCOUNT_KEY` / `AZURE_CONTAINER` | unset | Switches uploads to Blob Storage. Unset uses the local filesystem |
| `AZURE_URL_EXPIRATION_SECS` | `3600` | Lifetime of a signed photo URL |
| `CSRF_TRUSTED_ORIGINS` | tunnels | Needs the deployed origins added; the admin login fails CSRF without them |

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

Public registration (`/create`) always creates a `civilian`, and `user_type` is
read-only on `RegisterSerializer`, so asking `POST /accounts/register` for
`"bfp"` gets you a civilian regardless. Promotion is a deliberate act by an
administrator, in either of two places.

**Django admin** — the usual route. Open `/admin/`, **Accounts → Users**, pick
the account, and set **User type** to `BFP` under *FireTrace role*. Note that
`user_type` is not `is_staff`: `user_type` grants the operations dashboard,
`is_staff` only grants the admin itself.

**Shell** — when there is no superuser yet:
```
cd "FireTrace BackEnd/FireTrace"
python manage.py shell -c "from accounts.models import User; u = User.objects.get(username='the-email-they-registered-with'); u.user_type='bfp'; u.save()"
```

Then log in again on `/login` to see the BFP dashboard view.

Sign in with **either the username or the email address**, in any casing. For an
account made through the site those are the same string; a superuser created by
`createsuperuser` has a plain username and an unrelated email, and either works.
Registration folds usernames to lowercase, so a phone keyboard capitalising the
first letter cannot lock someone out.

## Photo storage

Report photographs go to **Azure Blob Storage** whenever `AZURE_ACCOUNT_NAME` and
`AZURE_ACCOUNT_KEY` are set, and to `MEDIA_ROOT` on the local filesystem
otherwise — so local development needs no Azure account and no credentials.

The blob container is **private**, and `django-storages` signs each URL with a
SAS token that expires (`AZURE_URL_EXPIRATION_SECS`, default one hour). This is
deliberate and worth keeping: a report photograph can show a person's home, their
belongings and their neighbours, and a public container would leave all of that
readable by anyone who ever saw a link, indefinitely and long after the incident
closed.

Two things this arrangement exists to survive:

- The container filesystem is **ephemeral**. Anything written to `MEDIA_ROOT` in
  the deployment is gone on the next restart or revision.
- There is no web server in front of Django to serve uploads. WhiteNoise handles
  `STATIC_ROOT` only, by design — it does not serve user media.

Locally, uploads are served by Django itself, but *only while `DEBUG` is on*;
`urls.py` registers the `MEDIA_URL` route under `if settings.DEBUG`.

## Deployment (Azure)

Everything lives in resource group `firetrace-rg`, region **East Asia**.

| Piece | Resource | Notes |
|---|---|---|
| Backend | Container App `firetrace-backend` | Ingress external, target port 8000 |
| Frontend | Static Web App `firetrace-web` | Free plan |
| Database | PostgreSQL Flexible Server `firetrace-db` | Burstable B1ms, database `firetrace` |
| Channel layer | Azure Managed Redis `firetrace-redis` | Balanced B0, **port 10000**, TLS |
| Images | Container Registry `firetraceacr` | Basic, admin user enabled |
| Uploads | Storage Account `firetracemedia` | Private container `media` |

- Backend: <https://firetrace-backend.purplesmoke-aadd2cd7.eastasia.azurecontainerapps.io>
- Frontend: <https://lively-meadow-0d7053600.7.azurestaticapps.net>

### Shipping a change

Both workflows fire on a push to `main`.

- `.github/workflows/build-backend.yml` builds the image on a GitHub runner and
  pushes it to ACR. Then roll the Container App onto it:
  ```
  d=$(az acr manifest list-metadata --registry firetraceacr --name firetrace-backend \
        --query "[?tags[0]=='latest'].digest | [0]" -o tsv)
  az containerapp update -n firetrace-backend -g firetrace-rg \
     --image "firetraceacr.azurecr.io/firetrace-backend@$d" --revision-suffix <name>
  ```
- `.github/workflows/azure-static-web-apps-*.yml` builds and deploys the
  frontend. Nothing further to run.

### Things that will cost you an afternoon

- **`az acr build` does not work on this subscription.** ACR Tasks are blocked on
  Azure for Students (`TasksOperationsNotAllowed`). That is why the image is
  built on a GitHub runner. This is not fixable per-account.
- **`az containerapp update --set-env-vars` replaces the entire environment**, it
  does not merge. Always resend every variable, or the ones you omit vanish.
- **Classic Azure Cache for Redis cannot be created**, separately from the above.
  Hence Azure Managed Redis, and hence port 10000.
- **"Southeast Asia" is blocked** by an Allowed-locations policy. East Asia works.
- **Resource providers may need registering first.** Creating the storage account
  failed with `SubscriptionNotFound` — a thoroughly misleading error — until
  `az provider register -n Microsoft.Storage` had completed.
- **The Static Web App wizard's "React" preset sets `output_location: build`**,
  which is Create React App's directory. Vite writes to `dist`, and the deploy
  fails looking for artifacts that were built correctly and put elsewhere.
- **`VITE_*` variables must be set on the build**, not in the Static Web App's
  Configuration blade. Vite inlines them at build time on the runner; the
  Configuration blade is runtime settings for the managed Functions API, which
  this app does not use. They are GitHub secrets referenced as step `env:`.
- **The frontend needs a `navigationFallback`** or every client-side route 404s
  on refresh. It lives in `FireTraceReact/public/staticwebapp.config.json`, in
  `public/` so Vite copies it into `dist/`.
- **The Google Maps key ships inside the public JS bundle**, unavoidably. Restrict
  it by HTTP referrer to the Static Web App domain, and keep a budget alert:
  referrer restrictions are a speed bump, not authentication.
