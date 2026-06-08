# HireMind AI

AI-powered recruitment platform — **MERN + Gemini 2.5 Flash + Python parser**.

This repository contains the **runnable** reference implementation of the HireMind AI guide, plus the expanded production-grade documentation.

## What's inside

```
hiremind-ai/
├── client/     # React (Vite) frontend
├── server/     # Node.js + Express API
├── parser/     # Python (Flask) resume parser microservice
├── docker/     # Optional docker-compose for one-command local stack
└── docs/
    ├── HireMind_AI_Implementation_Guide_v2_Full.md   ← merged full guide (1–42)
    ├── additions/                                     ← new prod-grade sections 29–42
    └── README.md
```

## Quick start (local dev)

> Detailed setup instructions: see **`docs/additions/42_Local_Setup_Guide.md`**.

```bash
# 1. Clone and enter
git clone <your-repo-url>
cd hiremind-ai

# 2. Copy and fill env files
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env
cp parser/.env.example parser/.env

# 3. Install
( cd server && npm install )
( cd client && npm install )
( cd parser && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt )

# 4. Initialise DB (idempotent)
( cd server && npm run seed:roles && npm run db:indexes )

# 5. Run (three terminals)
( cd server && npm run dev )      # :5000
( cd client && npm run dev )      # :3000
( cd parser && python app.py )    # :5001
```

Open **http://localhost:3000** in Chrome/Edge (voice requires Web Speech API).

## Documentation

* **Original modules 1–28** — your existing PDF/Word doc (untouched).
* **New sections 29–42** — `docs/additions/` (split by topic for readability).
* **Merged full guide** — `docs/HireMind_AI_Implementation_Guide_v2_Full.md`.

## Tech stack

| Layer       | Technology                       |
| :---------- | :------------------------------- |
| Frontend    | React 18 + Vite + Tailwind CSS   |
| Backend     | Node.js 20 + Express + Mongoose  |
| AI          | Gemini 2.5 Flash (Google AI Studio) |
| Resume Parser | Python 3.11 + Flask + pdfplumber + PyMuPDF |
| Database    | MongoDB (Atlas free tier)        |
| Cache/Queue (optional) | Redis + BullMQ        |
| File Storage (optional) | AWS S3              |
| Voice       | Web Speech API (browser-native)  |
| Reports     | PDFKit                           |
| Auth        | JWT (access + refresh) + bcrypt  |

## License

MIT — free for personal and commercial use.
