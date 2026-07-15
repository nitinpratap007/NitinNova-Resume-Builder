AI-Powered Resume Builder

This workspace contains a minimal full-stack scaffold for an AI-powered resume builder.

Structure
- backend/ — Flask API and AI integration stubs
- frontend/ — React (Vite) frontend with form and preview

Quick start

1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
set OPENAI_API_KEY=your_api_key_here
flask run --port 5000
```

2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Containerized deployment (Docker Compose)
1. Build and run services:

```bash
.\.venv\Scripts\Activate.\.venv\Scripts\Activatedocker-compose build
docker-compose up -d
```

2. Services:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

Notes:
- Edit `docker-compose.yml` to set a secure `JWT_SECRET` and change Postgres credentials before deploying to production.
- This compose file uses the Postgres service and mounts persistent volume `db_data`.

Production tips
- Use an environment store (Vault, environment variables on your host or container platform) for `JWT_SECRET` and DB credentials.
- Serve the backend behind TLS (use a reverse proxy like Nginx or a cloud load balancer). The frontend container serves static files on port 80.


Endpoints
- `POST /generate-resume` — polish user input via AI
- `POST /save-resume` — save resume to DB (sqlite by default)
- `GET /download/<resume_id>` — download resume (plain text placeholder)

Notes
- Replace the AI stub with your OpenAI or HuggingFace credentials.

Offline & Free Downloads
- The app can run fully locally: run the backend and frontend on your machine and no external services are required. The default AI polishing is a lightweight local fallback (no OpenAI key required), so resume generation and PDF export work without internet.
- You can export resumes for free in two ways:
	- Server PDF: run the backend and use `GET /download/<id>` — server generates a PDF using ReportLab.
	- Client PDF: the frontend includes a client-side PDF export (`jsPDF`) so users can download a PDF directly from the browser without contacting the server.

Offline notes
- To run fully offline, skip setting `OPENAI_API_KEY` (or leave it empty). The `ai_module` provides basic local formatting. If you want an advanced AI polish offline, you'll need a locally hosted model (e.g., a HuggingFace model served locally) — this is heavier and requires GPU/CPU resources.

Client-side polishing
Authentication & Admin
- The backend now includes simple JWT-based authentication endpoints:
	- `POST /auth/signup` — create user account (returns token)
	- `POST /auth/login` — login user (returns token)
	- `POST /auth/admin/signup` — create admin account (returns token)
	- `POST /auth/admin/login` — admin login (returns token)
- Tokens are stored in `localStorage` by the frontend and attached automatically to API requests.
- Admins can edit developer information which is exposed on the public `Developer` page; only admin users can POST updates to `/developer`.

User dashboard & ownership
- The app now supports user-owned resumes. After signing up and logging in, open the "Dashboard" page to see your saved resumes.
- Resumes saved while authenticated are associated with your account; only the owner (or an admin) can download, update, or delete those resumes.
- API endpoints:
	- `GET /my/resumes` — list resumes for the authenticated user
	- `PUT /resumes/<id>` — update a resume (owner/admin only)
	- `DELETE /resumes/<id>` — delete a resume (owner/admin only)

Invite-only admin signup
- Admin accounts must be created using an invite token. Admins can create invites from the app (see "Invites" in navigation) which returns a token string. Use that token when calling `POST /auth/admin/signup` (field `invite`) or via the frontend Admin SignUp form.
- This prevents unauthorized users from creating admin accounts in public deployments.

Refresh tokens & rate-limiting
- The app issues short-lived access tokens (15 minutes) and long-lived refresh tokens. Refresh tokens are returned from login/signup as `refresh` and should be stored securely (preferably `httpOnly` cookies in production). For development the frontend stores them in `localStorage` and uses `POST /auth/refresh` to rotate tokens.
- Endpoints:
	- `POST /auth/refresh` — exchange refresh token for new access+refresh (rotate)
	- `POST /auth/logout` — revoke a refresh token
- Rate-limiting: the backend integrates `Flask-Limiter` and applies limits to auth endpoints. Tune the limits in `backend/app.py`.



- The frontend includes a lightweight client-side polish (`frontend/src/localAI.js`) that converts your raw project and skills lines into action-oriented bullets without calling the backend or any external API. Use the "Generate (offline)" button in the UI to produce polished bullets entirely in the browser.

from models import SessionLocal, User
from werkzeug.security import generate_password_hash

db = SessionLocal()

email = "nitin.202410@gmail.com"
if db.query(User).filter(User.email == email).first():
    print("Admin already exists:", email)
else:
    admin = User(
        name="Nitin Pratap",
        email=nitin.202410@gmail.com,
        password_hash=generate_password_hash("nitin@9761183207"),
        is_admin=1
    )
    db.add(admin)
    db.commit()
    print("Admin created:", admin.id)

db.close()


