# FitTrack Pro — Phase 1 (Trainer-side)

Fitness client-tracking app for personal trainers: roster management, program building, live
set-by-set session logging with auto PR detection, progress charts, calendar, and activity feed.

Phase 1 is trainer-only — see `Downloads/FitTrack_Pro_Phase1_Prompt.md` for full scope and the
forward-compatible schema notes that keep Phase 2 (client login) a pure addition, not a rewrite.

## Stack

- Frontend: React + Vite + TypeScript, TanStack Query, React Hook Form + Zod, Tailwind, Chart.js, Clerk
- Backend: FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, Clerk JWT auth
- Local dev: Postgres via Homebrew (see `backend/POSTGRES_SETUP.md`)

## Setup

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL, CLERK_SECRET_KEY, CLERK_JWKS_URL
alembic upgrade head
python -m app.seed.seed_data
uvicorn app.main:app --reload --port 8010
```

Port 8010 (not 8000) is used deliberately so this can run alongside `trade-tracking-v2`'s
backend on the same machine without a conflict.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in VITE_CLERK_PUBLISHABLE_KEY
npm run dev
```

Frontend runs on http://localhost:5173 and proxies `/api` to the backend on :8000.

## Clerk setup

1. Create a free app at https://clerk.com
2. Copy the publishable key into `frontend/.env.local`
3. Copy the secret key + JWKS URL into `backend/.env`

Until real Clerk keys are set, the UI renders but sign-in/API calls will fail — see
`frontend/src/lib/clerk.ts` and `backend/.env.example` for exact variable names.

## Testing on an iPhone (same Wi-Fi network)

See the testing walkthrough provided alongside this build for the full outline.
