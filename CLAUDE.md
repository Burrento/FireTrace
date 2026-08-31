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
python manage.py test                        # 35 tests: incidents/tests.py + accounts/tests.py
python manage.py test incidents.tests.DuplicateFlaggingTests.test_name   # single test
python manage.py seed_demo_data [--reset]    # bfp@firetrace.test / firetrace123, then /bfp

# frontend (from FireTraceReact/)
npm run dev -- --host                        # --host exposes on LAN
npm run lint && npm run build
```

`runserver` prints **`Starting ASGI/Daphne`**, not the old WSGI line — `daphne` is
first in `INSTALLED_APPS` and replaces the dev server with an ASGI one so it can
speak WebSocket. If you see the WSGI line, the dashboard will silently fall back
to polling.

`.env` lives at the repo root (`FireTrace BackEnd/.env`), not inside `FireTrace/`;
`settings.py` reads `BASE_DIR.parent / '.env'`. The frontend has its own
`FireTraceReact/.env` for `VITE_API_BASE_URL` and `VITE_GOOGLE_MAPS_*`.

Promote a civilian account to BFP. Public registration creates civilians and
this is now **enforced** — `user_type` is read-only on `RegisterSerializer`, so
the API cannot grant it either. Use the admin (**Accounts → Users**, *FireTrace
role*), or the shell when there is no superuser yet:

```
python manage.py shell -c "from accounts.models import User; u=User.objects.get(username='email'); u.user_type='bfp'; u.save()"
```

`user_type` is not `is_staff`: `user_type` grants the operations dashboard,
`is_staff` only grants the admin. `accounts/admin.py` registers the custom user
model — Django only auto-registers `auth.User`, which this project replaced, so
without it the admin has no Users section at all.

---

## Architecture

### Django apps

| App | Role |
|---|---|
| `accounts` | Custom `User` (`AbstractUser` + `user_type` bfp/civilian), JWT auth, `IsBFPPersonnel` |
| `incidents` | Both record types, duplicate rule, geocoding grading, all report/incident/map views |
| `analytics` | `AuditLog` model + KPI / activity / health dashboard views |
| `realtime` | `notify.broadcast_dashboard_event` → Channels `group_send`; `consumers.DashboardConsumer` serves `/ws/dashboard` |

Routes: `/accounts/` auth (+ `me`, `me/password`, `users`, `users/<id>`) ·
`/api/reports/` · `/api/incidents/` · `/api/dashboard/` (kpis, map, activity,
audit, operational, reference, settings, backup/export, health — `map/` is
`incidents.views.DashboardMapView`, routed under analytics on purpose) ·
`/incidents/` deprecated alias for `/api/reports/` · `/ws/dashboard` WebSocket.

**The username *is* the email address.** Registration sets `username = email`, and
both `RegisterSerializer` and `LoginSerializer` fold it to lowercase. Django's
username lookup is exact-match, so without the fold a phone keyboard capitalising
the first letter locks someone out of their own account. Register also rejects an
email that already exists under any casing, which the model's own unique check
(case-sensitive) would let through.

Login accepts **either the username or the email**, resolving to the stored
username before authenticating. For site-made accounts those are one string; a
`createsuperuser` account has a plain username and an unrelated email and could
otherwise never sign in on the site. An identifier matching nothing is passed
through unchanged so authentication fails the ordinary way — a distinct error
would let a caller probe which accounts exist.

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
forecasting, no risk scoring, no automated dispatch. Every rate the Operational
page returns carries its own numerator and denominator, so a percentage can
never be read without its sample size, and `percent` is `null` rather than `0`
when nothing was counted — "no data" and "none of them" are different claims.

**Two thresholds are runtime-editable, the rest are not.** `analytics.SystemSetting`
is a `pk=1` singleton holding the duplicate radius, the duplicate window and the
live map window. It seeds itself from the `settings.py` values on first read, so
an installation nobody has touched behaves exactly as it did before it existed.
`duplicates._thresholds()` and `DashboardMapView._recent_hours()` read it on
every call rather than caching, so a change applies to the next report rather
than the next restart, and every write is audited with the old and new value.
The geocoding confidence bands stay in `settings.py` on purpose: retuning them
from a form would silently re-grade what past reports meant.

### Map scope: one endpoint, two audiences

`DashboardMapView` serves both maps so they can never disagree about what a record
is or how it is drawn — only about which records they ask for.

- `scope=recent` (default) — the live dashboard. Returns records created within
  `?hours=` **or** in an `ONGOING_STATUSES` state (Verified / Responding). "Current"
  is about the response, not the clock: a fire someone is actively working stays on
  the map however long ago it came in, while a report merely sitting in Submitted
  ages out. Implemented as a `Q` OR, not ANDed kwargs.
- `scope=all` — the All Reports page. Every record, any age, any status.

`?hours=` is clamped to `MAP_RECENT_HOURS_CHOICES` (1 / 6 / 24, default
`MAP_RECENT_HOURS = 1`). Clamped rather than trusted: an arbitrary value would turn
the live map back into the unbounded query the filter exists to prevent.

### Write path

Every personnel mutation goes through `incidents/services.record_activity(...)`,
which writes an `IncidentTimelineEvent` *and* an `AuditLog` row in one call. The two
vocabularies differ deliberately: the timeline is the history of an incident, the
audit log is the history of personnel activity. Then the view calls
`broadcast_dashboard_event(...)`. Follow that order in any new mutating view.

Read scoping is centralised in `ReportQuerysetMixin` — civilians see only their own
reports. Everything under `/api/dashboard/` and every queue/incident view uses
`IsBFPPersonnel`.

### Real-time

`broadcast_dashboard_event` does a Channels `group_send` to `DASHBOARD_GROUP`;
`DashboardConsumer` relays it to every connected operator. **The push carries no
incident data** — it means "refetch now" and the browser goes back through the REST
endpoints, so read scoping, permissions and serialisation stay in one place. The win
is latency, not a second API.

The socket authenticates on its **first message, not a query parameter** — a token in
a URL lands in server logs, browser history and any proxy between. Nothing joins the
broadcast group until the token validates and the user is BFP. Close codes mirror
HTTP in the application range: `4401` unauthenticated (the frontend renews through
`api.js`'s shared refresh and retries), `4403` not personnel (it stops reconnecting).

CORS does not apply to WebSockets, so `asgi.py` wraps the router in
`AllowedHostsOriginValidator` — the socket's Origin must be a host Django already
trusts.

### Frontend

Single Vite SPA, routes in `src/App.jsx`, wrapped in `ThemeProvider` +
`ReportDraftProvider`. Two shells share one app:

- **Civilian**, a phone column — `#root` is capped at `480px` in `index.css`.
- **BFP portal** — `pages/bfp/BfpShell.jsx` holds the access check, header and tab
  bar for *every* portal screen, so adding a page cannot accidentally ship one
  without the personnel check. It sets `document.body.dataset.shell='bfp'` on mount
  and removes it on unmount; `styles/bfp-dashboard.css` keys off
  `body[data-shell='bfp']` to escape the 480px cap.
  - `/bfp` — operations overview: KPIs, **recent** map, health, activity.
  - `/bfp/reports` — the archive: all-time map + the filterable queue.

`src/api.js` — `apiFetch` hardcodes `Content-Type: application/json`, attaches the
bearer token, and on a 401 refreshes once through a **shared** promise so parallel
401s trigger one refresh. Errors keep DRF's field names (`describeError`) instead of
flattening them to bare messages, and the raw payload is attached as `error.fields`;
an anonymous "This field may not be blank." on the wrong screen is how a missing
step-1 description used to read as a photo problem.

`src/auth.js` picks `localStorage` (remember me, paired with a 30-day refresh token)
vs `sessionStorage`; reads check both.

The report wizard (`pages/report-wizard/`) is **three steps**, and step 3 files the
report:

```
/report → /continue2 → /continuethird → /continue4
 details    location      photo+SUBMIT     receipt (not a step)
```

One draft accumulates in `ReportDraftContext`, persisted to `sessionStorage`.
`PhotoStep` POSTs it on a button press and hands the created record to
`ConfirmationStep` in router state; that screen submits nothing and redirects to
`/myreport` if it has no state. Submitting on a press rather than on arrival at the
receipt is what stops a refresh filing a second copy of the same fire. Every step
gates its own Continue, so a missing field is caught on the step that owns it.

`PhotoStep` holds **two** hidden file inputs, not one: `capture="environment"`
asks the phone for the camera directly and must be *absent* for a gallery pick,
so one input cannot serve both buttons. A report with a photo is posted as
`FormData`; `api.js`'s `send()` omits its hardcoded `Content-Type` for a
`FormData` body so the browser can set the multipart boundary itself. The preview
URL is derived with `useMemo` and revoked on change, since object URLs live until
revoked and a reporter retaking a shot would otherwise leak each attempt.

`ReportDraftContext` rounds `latitude`/`longitude` to 6 dp on the way in **and** on
restore from `sessionStorage`. The columns are `DecimalField(max_digits=9,
decimal_places=6)`, and a raw Google Maps coordinate carries a dozen decimals — until
this was added, no map-pinned report could be filed at all.

`pages/bfp/useDashboardData.js` — one clock drives every panel so they all show
the same moment. The clock is a WebSocket to `/ws/dashboard`. The timer survives as a
fallback: 15s while the socket is down, 60s once it is live, so a missed push means a
minute stale rather than a silently frozen screen. It pauses on a hidden tab and
refreshes on return; the socket stays open (cheap while idle, and the screen is
already current when the operator looks back). The header shows **Live** with a green
pulse only while the socket is genuinely up, **Polling** with a grey dot otherwise.

`components/bfp/DashboardMap.jsx` — a report pulses a red ring for
`PULSE_WINDOW_MS` (90s), read off `created_at` rather than diffed between polls so it
survives a remount and a background tab. The window is deliberately wider than the
fallback poll, so a report is still pulsing when the refresh carrying it lands.
`FocusOnNewReport` pans the camera to a new report and settles at zoom 15 — it only
reacts to an id it has not focused before (so manual panning is not fought) and never
zooms *out*. The archive map passes `focusOnNew={false}`.

The marker popup shows the reporter's photograph, from the signed `photo_url` the
map endpoint returns beside `has_photo`. It is dismissed by a `pointerdown`
listener on the **map container**, not by `<Map onClick>`: an open InfoWindow
lays a wrapper over the map much larger than the visible bubble, and a press on
that wrapper never reaches the map — which is most of where "just outside the
bubble" actually is. `pointerdown` rather than `click` so it runs before a
marker's own handler, letting a press on a different pin close the old popup and
open the new one instead of the two fighting over the same state.

---

## Deployment

Live on Azure, resource group `firetrace-rg`, region **East Asia**. Backend is
Container App `firetrace-backend`; frontend is Static Web App `firetrace-web`;
Postgres `firetrace-db`; Azure Managed Redis `firetrace-redis` (port **10000**,
TLS); registry `firetraceacr`; uploads in storage account `firetracemedia`.
README has the URLs and the deploy commands.

Both GitHub workflows fire on a push to `main`. The frontend deploys itself; the
backend only builds an image, so rolling the Container App onto it is a separate
`az containerapp update`.

**That asymmetry is a trap.** A push to `main` ships the new React bundle
immediately while the backend keeps serving the old image until you roll it by
hand, so any page depending on a new endpoint shows its error state in between.
Roll the container in the same sitting, or expect a window where the portal
looks broken.

**The container migrates itself on boot** — the `CMD` is
`migrate --noinput && exec daphne ...`. This exists because a schema change must
not be able to outlive the deploy that needs it: `duplicates._thresholds()`
reads the `SystemSetting` row on *every* report submitted, so a container
running ahead of its migrations would 500 on civilian report submission, not
just on the admin screens that introduced the table. A failed migration aborts
startup rather than serving against a mismatched schema. It assumes **one
replica** — scaling `firetrace-backend` out means several replicas racing to
migrate on boot, which needs a lock or a separate migration job first.

**This subscription is Azure for Students and blocks things.** `az acr build` /
ACR Tasks are refused, which is why images build on a GitHub runner. Classic
Azure Cache for Redis cannot be created, hence Managed Redis and its unusual
port. "Southeast Asia" is blocked by policy while East Asia is fine. Resource
providers may need `az provider register` first — creating the storage account
failed as `SubscriptionNotFound`, which is not what that means.

---

## Unfinished work

**No UI to create a canonical `Incident`** — the biggest functional hole. The API is
complete but the queue has no row selection and nothing calls
`POST /api/incidents/verify/`. Consequence: the Responding and Resolved KPI cards
read 0 forever in real use, since only `seed_demo_data` or the admin creates any.

**Timeline endpoints are unused.** `/api/reports/<id>/timeline/` and
`/api/incidents/<id>/timeline/` are built and tested; no screen consumes them, and
clicking a queue row does nothing.

**No restore endpoint, deliberately.** `/api/dashboard/backup/export/` produces a
full JSON export (no password hashes) and audits itself. There is no import
counterpart: replacing a live database from an uploaded file is destructive and
all-or-nothing, and behind a form any signed-in operator can reach, one mis-click
loses every fire reported so far. `BfpBackup.jsx` documents Azure Postgres
point-in-time restore as the actual recovery path. There is also no scheduler in
this application, so nothing claims to run scheduled backups — Azure does that.

**`BfpAnalyticReport` duplicates `BfpReports`.** Both render `ReportsQueue`; the
Analytics one just omits the map. Nav lists them under different groups. Worth
collapsing or differentiating.

**Civilian app still on the legacy path.** It posts to `/incidents/`
(`incidents/legacy_urls.py`) and reads `report.status`, a read-only serializer alias
for `workflow_status`. Both can be deleted once the civilian pages move over.

### Testing gaps
No frontend tests. `realtime/tests.py` is still empty — the consumer is
uncovered. `analytics/tests.py` now covers the audit, operational, reference,
settings, export and health endpoints, plus that a changed threshold actually
changes what gets flagged. `accounts/tests.py` covers registration, the
privilege-escalation attempt and the login split; `accounts/test_administration.py`
covers profile editing, password change and the user-admin guards. 109 tests
total. The dashboard and the wizard have been verified by hand in a browser, not
by a suite.

**A passing end-to-end check is not proof the feature works.** The realtime
socket was verified end to end and still failed in real use: that test received
its broadcast within seconds, before the first idle blocking read could time out.
Anything long-lived needs to be observed *idle*, not just exercised once.

### Known small issues
- **Password reset is still a stub.** `ForgotPasswordRequest.jsx` and
  `ForgotPasswordReset.jsx` navigate onward without calling any API — there is
  no reset endpoint behind them. They lint clean, which is not the same as
  working.
- **Contact-number changes do not send an OTP.** The design called for one;
  there is no SMS gateway configured, so `ContactInfo.jsx` saves the number
  directly rather than pretending to text a code.
- `SECRET_KEY` is hardcoded as a fallback in `settings.py`; the deployment
  overrides it from a secret. `DEBUG` is env-driven and defaults to False.
- `ALLOWED_HOSTS` is `"*"` in the deployment. Tightening it means adding the
  Static Web App origin too — `asgi.py` validates the **WebSocket** Origin
  against `ALLOWED_HOSTS`, since CORS does not apply to sockets, so narrowing it
  carelessly silently drops realtime back to polling. Container Apps health
  probes also send the container IP as `Host`.
- 26 `.pyc` files are tracked in git, including `settings.cpython-314.pyc`, which
  shows as modified after every run.
- Email backend is console-only, so password reset mails print to the terminal.
- `django-filter` is installed and in the `Pipfile` but never imported — queue
  filtering is hand-written in `ReportQueueView.get_queryset`. Use it or drop it.

---

## Dependencies NOT installed

Nothing below is needed for current code to run.

- **Redis, locally.** `CHANNEL_LAYERS` falls back to `InMemoryChannelLayer` when
  `REDIS_HOST` is unset — no server needed, but it only reaches clients on the
  same process (fine for `runserver`). The deployment sets `REDIS_HOST` and uses
  the Redis layer. Nothing on this machine can run a Redis today — no Docker, and
  `wsl` is a stub — so the Redis path is only exercised against Azure.
- **Pillow** — only if `IncidentReport.photo` switches `FileField` → `ImageField`.
  It is a `FileField` specifically to avoid the dependency; the Pillow wheel on
  Python 3.14 is untested. Photo uploads work without it.
- **An Azure storage account, locally.** Uploads fall back to `FileSystemStorage`
  when `AZURE_ACCOUNT_NAME`/`AZURE_ACCOUNT_KEY` are unset.
- **Frontend: nothing.** The dashboard uses only what is already in `package.json`.

`django-storages[azure]` **is** installed and in the `Pipfile`. Editing the
`Pipfile` means running `pipenv lock` — the Dockerfile installs with
`--deploy`, which refuses a lock file whose hash does not match.

### Installed vs. thesis-specified versions — unresolved

| Component | Thesis spec | Installed |
|---|---|---|
| Python | 3.12 | 3.14.6 (`Pipfile` pins 3.14) |
| Django / DRF | 5.2 / 3.16 | 6.0.6 / 3.18 |
| Node / PostgreSQL | 22 LTS / 17 | 24.16 / 18.6 |
| React | 19 | 19.2.8 ✓ |
| Channels / Redis | 4.2 / 7.2 | 4.3.2 + daphne 4.2.3 / Azure Managed Redis in the deployment, in-memory locally |

Downgrading Python or Postgres means rebuilding the virtualenv and the database.

---

## Gotchas

- **Model renames need hand-written migrations.** `0002` renames `Incident` →
  `IncidentReport`; left alone, `makemigrations` emits DeleteModel + CreateModel and
  drops every row.
- **Use `127.0.0.1`, not `localhost`, in `VITE_API_BASE_URL`.** `runserver 0.0.0.0`
  binds IPv4 only, while Chrome on Windows resolves `localhost` to `::1` first — the
  connection is refused before Django sees it. The page still loads (Vite listens on
  both stacks), so it presents as "the API is down".
- **Login errors are not always login errors.** A `DisallowedHost` 400 arrives with
  no CORS headers and reads to the browser as a network failure. `Login.jsx`
  distinguishes 401 (bad credentials) from no-status (unreachable) and names the URL
  it tried; keep that distinction if you touch it.
- **`ALLOWED_HOSTS` auto-trusts this machine's LAN IPs when `DEBUG`.** `settings.py`
  resolves them via `socket.gethostbyname_ex`, so phone testing survives a DHCP lease
  change without editing `.env`. CORS already trusts the same private ranges by regex.
- **Coordinates must be ≤ 6 decimal places** before they reach the API — see
  `ReportDraftContext`. The failure is a `"no more than 9 digits in total"` validation
  error, which does not name latitude or longitude.
- **`prefers-reduced-motion` is on for some machines here** (Windows → Accessibility →
  Visual effects). Do not answer it with `animation: none` for the new-report pulse:
  it is the one alert on the screen that must not be missed, so the reduced-motion
  branch keeps a gentler in-place "breathe" instead. Decorative motion may stop.
- **The Redis channel layer has three settings that look tidyable and are not.**
  The backend is `channels_redis.pubsub.RedisPubSubChannelLayer`, *not* the
  default `core.RedisChannelLayer`: Azure Managed Redis is clustered, and the
  core layer pipelines across one key per channel, so with more than one
  subscriber the keys land in different slots and every `group_send` aborts with
  `ClusterCrossSlotError`. `address` must be a URL *string* — a `(host, port)`
  tuple raises `'tuple' object has no attribute 'decode'` on the first
  `group_add`, visible only as a 1011 socket close. And `socket_timeout` must
  stay above 5s, or a core-layer consumer blocking in `bzpopmin(timeout=5)` dies
  on every idle read (redis-py reuses the blocking timeout as the read deadline,
  giving up at 5.000s while Azure answers at ~5.2s). All three look like
  "realtime just doesn't work" rather than like an error.
- **`broadcast_dashboard_event` swallows every exception by design**, so a broken
  channel layer is silent on the write side. Diagnose realtime from the container
  logs and an actually-idle socket, not from whether reports save.
- **`az containerapp update --set-env-vars` replaces the whole environment**, it
  does not merge. Resend every variable each time.
- **Bash heredocs work; large ones do not.** A `<<'EOF'` heredoc writes a clean
  LF file that Python parses fine. What fails is *size*: past roughly 20 KB the
  whole command is rejected with `ENAMETOOLONG: uv_spawn` before the shell runs,
  so use the Write tool for anything longer than a few hundred lines. (The old
  note here blamed CRLF; that was the wrong diagnosis.)
- **`/tmp` is not shared between Bash and Python here.** Git Bash resolves it
  inside the MSYS root, while the Windows Python interpreter does not see that
  path at all — a file written with `cat > /tmp/x` is a `FileNotFoundError` to
  the very next `python -c "open('/tmp/x')"`. Stage scratch files in the repo
  directory instead.
- `manage.py shell < script.py` swallows output; use `shell -c "$(cat script.py)"`.
- `IncidentReport.reference_number` is a **property, not a field** — it cannot be used
  in a `filter()`. Query by `id` or `created_at` instead.
- Uploaded photos land in `MEDIA_ROOT` and are **not** rolled back by a transaction —
  clean `FireTrace/media/` after a rolled-back seed run, and give any test that
  saves an upload its own `MEDIA_ROOT` (see the map photo test) or it grows the
  directory by a file per run.
- **`DEBUG` defaults to False, including locally.** `urls.py` registers the
  `MEDIA_URL` route under `if settings.DEBUG`, so without `DEBUG=True` in `.env`
  a photo uploads fine and then 404s on display. It also gates the LAN-IP
  auto-trust used for phone testing.
- **Photo URLs are SAS-signed and expire** (default 1h) when Blob Storage is
  configured. A URL captured in a fixture or left open in a stale tab stops
  working; that is the signature ageing out, not a broken upload.
- Phone testing: the LAN IP must match `VITE_API_BASE_URL`, `ALLOWED_HOSTS` and
  `CORS_ALLOWED_ORIGINS`. Tunnel hosts (`*.trycloudflare.com`, `*.ngrok-free.app`)
  are already allowed by regex in `settings.py`.
