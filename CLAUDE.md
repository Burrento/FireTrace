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

`runserver` prints **`Starting ASGI/Daphne`**, not the old WSGI line — `daphne` is
first in `INSTALLED_APPS` and replaces the dev server with an ASGI one so it can
speak WebSocket. If you see the WSGI line, the dashboard will silently fall back
to polling.

`.env` lives at the repo root (`FireTrace BackEnd/.env`), not inside `FireTrace/`;
`settings.py` reads `BASE_DIR.parent / '.env'`. The frontend has its own
`FireTraceReact/.env` for `VITE_API_BASE_URL` and `VITE_GOOGLE_MAPS_*`.

Promote a civilian account to BFP (public registration always creates civilians
**by convention, not by enforcement** — see Known small issues):

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
under analytics on purpose) · `/incidents/` deprecated alias for `/api/reports/` ·
`/ws/dashboard` WebSocket.

**The username *is* the email address.** Registration sets `username = email`, and
both `RegisterSerializer` and `LoginSerializer` fold it to lowercase. Django's
username lookup is exact-match, so without the fold a phone keyboard capitalising
the first letter locks someone out of their own account. Register also rejects an
email that already exists under any casing, which the model's own unique check
(case-sensitive) would let through.

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

---

## Unfinished work

**No UI to create a canonical `Incident`** — the biggest functional hole. The API is
complete but the queue has no row selection and nothing calls
`POST /api/incidents/verify/`. Consequence: the Responding and Resolved KPI cards
read 0 forever in real use, since only `seed_demo_data` or the admin creates any.

**Photo capture is a stub.** `report-wizard/PhotoStep.jsx`'s two buttons do nothing,
and they now sit on the final screen where they are more prominent. The backend
accepts `photo` on `POST /api/reports/` and the queue's Photo column works, but real
submissions always show "no photo". Uploading needs `multipart/form-data`, so
`apiFetch` needs a path that doesn't force a JSON content type.

**Timeline endpoints are unused.** `/api/reports/<id>/timeline/` and
`/api/incidents/<id>/timeline/` are built and tested; no screen consumes them, and
clicking a queue row does nothing.

**Civilian app still on the legacy path.** It posts to `/incidents/`
(`incidents/legacy_urls.py`) and reads `report.status`, a read-only serializer alias
for `workflow_status`. Both can be deleted once the civilian pages move over.

### Testing gaps
No frontend tests. `analytics/tests.py`, `realtime/tests.py`, `accounts/tests.py`
are empty — KPI/activity/health views, the consumer, the map `scope`/`hours`
filtering and the username fold are all uncovered by tests. The dashboard, the
wizard and the WebSocket push have been verified by hand in a browser, not by a
suite.

### Known small issues
- **`RegisterSerializer` exposes `user_type` as writable.** Anyone can
  `POST /accounts/register` with `user_type: "bfp"` and get full personnel access.
  The "public registration always creates civilians" rule is convention only.
- `CreateAccount.jsx` posts `first_name`, but it is not in `RegisterSerializer.Meta.
  fields`, so it is silently dropped — which is *why* `Dashboard.jsx`'s
  `user.first_name` is always `undefined` and falls back to `username`. Fixing the
  display alone will not help; the name is never stored.
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
| Django / DRF | 5.2 / 3.16 | 6.0.6 / 3.18 |
| Node / PostgreSQL | 22 LTS / 17 | 24.16 / 18.6 |
| React | 19 | 19.2.8 ✓ |
| Channels / Redis | 4.2 / 7.2 | 4.3.2 + daphne 4.2.3 / no Redis (in-memory layer) |

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
- Bash heredocs (`<<'EOF'`) into files fail on CRLF here — use the Write tool for
  multi-line source files.
- `manage.py shell < script.py` swallows output; use `shell -c "$(cat script.py)"`.
- `IncidentReport.reference_number` is a **property, not a field** — it cannot be used
  in a `filter()`. Query by `id` or `created_at` instead.
- Uploaded photos land in `MEDIA_ROOT` and are **not** rolled back by a transaction —
  clean `FireTrace/media/` after a rolled-back seed run.
- Phone testing: the LAN IP must match `VITE_API_BASE_URL`, `ALLOWED_HOSTS` and
  `CORS_ALLOWED_ORIGINS`. Tunnel hosts (`*.trycloudflare.com`, `*.ngrok-free.app`)
  are already allowed by regex in `settings.py`.
