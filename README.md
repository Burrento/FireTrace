# FireTrace

Accounts - BFP + Civilian user auth
Incidents - Incident/Report Models, duplicate detection
Dispatch - Real-time updates via Channels/WebSocket
Analytics - Descriptive operational intelligence module

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
