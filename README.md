# OnePilot Base

The base repository for **OnePilot** — an AI-powered WhatsApp platform. This is the foundation that all OnePilot deployments start from.

## Stack

| Layer     | Tech                                                              |
| --------- | ----------------------------------------------------------------- |
| Frontend  | Next.js 16, shadcn/ui, Tailwind CSS 4, HugeIcons                  |
| Backend   | FastAPI, SQLModel (SQLite), Pydantic AI v2, JWT, Argon2           |
| Auth      | Email/password login, platform admin seeding                      |

## Quick Start

```bash
chmod +x setup.sh && ./setup.sh
```

Or manually:

**Backend:**
```bash
cd backend
uv venv
uv pip install -r requirements.txt
uv run python -m app.seed
uv run python -m app
```

**Frontend:**
```bash
cd frontend
npm ci
npm run dev
```

Login: `admin@onecorestack.com` / `password`

## Pages

- `/login` — authentication
- `/dashboard` — main workspace
- `/chat` — AI chat interface (WIP)
- `/configure` — configuration (WIP)
- `/settings` — settings (WIP)
