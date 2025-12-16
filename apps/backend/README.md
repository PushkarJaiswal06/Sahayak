Backend service (FastAPI) scaffold. Key commands:

- Install deps: `D:/Sahayak/.venv/Scripts/python.exe -m pip install -r requirements.txt`
- Run dev: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- Run migrations: `alembic upgrade head` (from apps/backend)
- Generate migration: `alembic revision --autogenerate -m "message"`
