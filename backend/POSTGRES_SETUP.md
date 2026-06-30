# PostgreSQL Setup

## 1. Install PostgreSQL (macOS)

```bash
brew install postgresql@16
brew services start postgresql@16
```

## 2. Create the database

```bash
createdb fittrack_pro
```

Or via psql:

```sql
CREATE DATABASE fittrack_pro;
```

## 3. Set the connection string

Edit `backend/.env` and set `DATABASE_URL` to match your local setup:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/fittrack_pro
```

If you created the DB without a password (default macOS Homebrew install), use your macOS
username instead of `postgres` and drop the password:

```
DATABASE_URL=postgresql://yourusername@localhost:5432/fittrack_pro
```

## 4. Run migrations

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m app.seed.seed_data
```
