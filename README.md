# Smart Safe Routes (React + FastAPI)

This repo contains:
- `frontend/` React (Vite) app with a landing page (pure CSS) and a placeholder map page.
- `backend/` Python FastAPI API (Python-only backend).

## Quick start

### Backend (FastAPI)
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Test:
- http://localhost:8000/health

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```
Open:
- http://localhost:5173

> In development, the frontend calls the backend at `http://localhost:8000`.
