# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FireTrace is a Django + Django REST Framework backend, at an early scaffolding stage — most apps still contain only boilerplate (empty `models.py`/`views.py`) with no migrations generated yet. Per the README, the intended scope per app is:

- **accounts** — BFP (Bureau of Fire Protection) + civilian user auth. Implemented end-to-end: custom `User` model (`AbstractUser` + `user_type` choice field: `bfp`/`civilian`), JWT auth via `djangorestframework-simplejwt`, register/login/refresh/me endpoints, and a working React flow (Create Account → Login → role-based Dashboard) — see Architecture notes.
- **incidents** — Incident/report models, duplicate detection
- **realtime** — Real-time updates via Django Channels/WebSocket (package not yet in Pipfile)
- **analytics** — Descriptive operational intelligence module

The Django project root is `FireTrace/FireTrace/` (settings, urls, asgi/wsgi) and apps live alongside it under `FireTrace/` (`FireTrace/accounts`, `FireTrace/incidents`, `FireTrace/realtime`, `FireTrace/analytics`) — i.e. there are two nested `FireTrace` directories: the repo root and the Django project package.

## Development priority

Focus on building out FireTrace's own functionality (API endpoints, models, serializers, views consumed by the React frontend) rather than the Django admin panel. Registering models in `admin.py` for basic DB inspection during dev is fine, but don't spend implementation effort polishing admin (custom admin views, admin-only features, admin UI work) — that's not the product surface this project cares about right now.

## Target Technology Stack

The project's design docs (Table 3.11) specify this full-stack target — this repo currently implements only a slice of it (see "Architecture notes" below for what's actually installed today):

| Component | Technology | Notes |
|---|---|---|
| Database | PostgreSQL 17 | Replaces the current SQLite dev DB for production |
| Backend language | Python 3.12 | |
| Backend framework | Django 5.2 | |
| REST API | Django REST Framework 3.16 | |
| Real-time | Django Channels 4.2 | Backs the `realtime` app's WebSocket/notification purpose |
| In-memory store | Redis 7.2 | Channel layer + session/cache backing for Channels |
| Frontend | React 19 + Node.js 22 LTS | Civilian PWA + BFP portal — lives in this repo at `FireTraceReact/` (Vite + react-router-dom), not a separate repo |
| Mapping/geolocation | Google Maps Platform API + Browser Geolocation API | For incident location capture and reverse geocoding, used by `incidents` |

Note: this is the target, not the current state — the Pipfile currently pins Python 3.14 (not 3.12) and leaves Django/DRF unpinned (`*`), and Channels/Redis aren't in the Pipfile yet. PostgreSQL is already wired up via `django-environ` reading `.env` (see Architecture notes), ahead of the rest of the target stack.

## Commands

See `README.md` for the full dependency list and run instructions (backend + frontend, including LAN/phone access).

Run backend commands from `FireTrace BackEnd/FireTrace/` (where `manage.py` lives), using `pipenv run` or inside a `pipenv shell`.

```
pipenv install               # install backend dependencies (see Dependencies.md)
pipenv shell                 # activate the virtualenv

python manage.py runserver
python manage.py migrate
python manage.py makemigrations <app>
python manage.py check
python manage.py test                 # run all tests
python manage.py test accounts        # run tests for a single app
python manage.py test accounts.tests.TestClassName.test_method_name  # run a single test
python manage.py createsuperuser
```

Python version is pinned to 3.14 in the Pipfile.

Run frontend commands from `FireTrace BackEnd/FireTraceReact/`:

```
npm install
npm run dev              # local only (localhost:5173)
npm run dev -- --host    # also reachable on LAN, e.g. from a phone on the same Wi-Fi
```

## Architecture notes

- Standard Django app-per-domain layout. `incidents`, `realtime`, `analytics` still have the default `admin.py`/`apps.py`/`models.py`/`views.py`/`tests.py`/`migrations/` skeleton with no real implementation yet. `accounts` now has a real implementation (see below).
- Only `accounts` is wired into the project's `urls.py` so far (`include('accounts.urls')` under `/accounts/`); the other apps have no URL routing configured yet.
- `rest_framework` is installed; `accounts/serializers.py` is the first serializers module in the project (`RegisterSerializer`, `UserSerializer`) — follow that pattern (serializers + DRF generic views) for `incidents`/`analytics` once endpoints are added there.
- **Auth (`accounts`)**: `AUTH_USER_MODEL = 'accounts.User'`, a custom model subclassing `AbstractUser` with a `user_type` field (`bfp` / `civilian`, default `civilian`). Auth is JWT via `djangorestframework-simplejwt`, configured as the default DRF authentication class in `settings.py`. Endpoints under `/accounts/`: `register` (open, always creates `user_type='civilian'` — BFP accounts aren't self-registrable), `login` (`TokenObtainPairView`), `login/refresh` (`TokenRefreshView`), `me` (authenticated, returns the current user). `accounts.User` is intentionally **not** registered in Django admin — per Development priority above, effort here goes to FireTrace's own UI, not the admin panel.
- Database is **PostgreSQL** (not SQLite) via `django.db.backends.postgresql`, configured in `settings.py` through `django-environ` reading `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT` from a `.env` file at the repo root (see `.env.example`). `DEBUG = True` and a hardcoded `SECRET_KEY` in `settings.py` are dev-only and must not ship to production as-is.
- Because `AUTH_USER_MODEL` now points at `accounts.User`, `accounts`'s initial migration must always apply before `admin`/`auth`'s — this only bites if the DB was previously migrated with the stock `auth.User` (fixed once during accounts setup by dropping and recreating the dev DB). Keep this in mind if `migrate` ever raises `InconsistentMigrationHistory`.
- Pyright/Pylance is configured (`pyrightconfig.json`, `.vscode/settings.json`) with `./FireTrace` (the Django project dir) as an extra analysis path, since app modules are imported relative to that directory rather than the repo root. Pyrefly (a separate type checker/extension) has its own `pyrefly.toml` at the repo root pointing at the pipenv venv's interpreter, since it doesn't read VS Code's `python.defaultInterpreterPath` setting.
- **Frontend (`FireTraceReact/`)**: Vite + React 19 + `react-router-dom`. Pages: `Welcome` (`/`), `CreateAccount` (`/create`), `Login` (`/login`), `Dashboard` (`/dashboard`, role-based — shows "You are a BFP personnel" or "You are a Civilian" from `/accounts/me`'s `user_type`). `src/api.js` holds the shared `API_BASE_URL` and a `fetch` wrapper — reuse it rather than hardcoding the backend URL in new pages. Create Account uses the entered email as the `username` sent to `/accounts/register` (there's no separate username field in the UI) and always registers as `civilian`; promote to `bfp` manually via `python manage.py shell` (no self-service BFP registration by design). JWT tokens from `/accounts/login` are stored in `localStorage` (`access`/`refresh`) and sent as `Authorization: Bearer <access>` on authenticated requests (e.g. `Dashboard` calling `/accounts/me`).
- **LAN/phone access**: `API_BASE_URL` in `FireTraceReact/src/api.js`, Django's `ALLOWED_HOSTS`, and `CORS_ALLOWED_ORIGINS` in `settings.py` are all hardcoded to a specific LAN IP (`192.168.1.22`) rather than derived dynamically. If that IP changes (different network, DHCP reassignment), all three must be updated together, and the frontend origin (`http://<ip>:5173`) must be present in `CORS_ALLOWED_ORIGINS` or cross-origin requests from a phone will be blocked.
