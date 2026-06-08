# HireMind AI — PRD

## Original problem statement
User uploaded `HireMind_AI_Implementation_Guide.pdf` (28 sections) and asked to:
1. Expand the guide with **13 new production-grade sections** (29–42): End-to-End Workflow, State Management, Question Generation, AI Evaluation, Behavioral Intelligence, Recruiter Decision Intelligence, AI Guardrails, Enterprise Security, Scalability, Observability, DB Optimization, Gemini Prompt Engineering, Future AI Roadmap, **+ Local Setup Guide**.
2. Deliver docs in **two formats**: split per-section files **and** one merged full guide.
3. Scaffold a **fully runnable** local project at `/app/hiremind-ai/`:
   - **Backend**: Node.js / Express / MongoDB
   - **Frontend**: React (Vite + Tailwind)
   - **Parser**: Python / Flask (pdfplumber + PyMuPDF)
   - **Queue**: Redis + BullMQ
   - **AI**: Gemini 2.5 Flash (Google AI Studio, user-provided key)

## Architecture
```
/app/hiremind-ai/
├── client/      React 18 + Vite + Tailwind + react-router (3000/3001)
├── server/      Express + Mongoose + JWT auth + Gemini SDK (5000)
├── parser/      Flask + pdfplumber + PyMuPDF (5001)
├── docker/      docker-compose for one-command stack
└── docs/
    ├── HireMind_AI_Implementation_Guide_v2_Full.md   ← merged guide
    ├── additions/29..42_*.md                          ← 14 split files
    └── README.md                                       ← docs index
```

## Implemented (✅)
- All 14 addition documents (§29–§42) ~110 KB total markdown.
- Merged full guide (`HireMind_AI_Implementation_Guide_v2_Full.md`) — references original §1–28 + inlines §29–§42.
- Backend: 8 route groups (health/auth/roles/candidate/interview/hr/admin/analytics), 6 Mongoose models, 12 services, RBAC + sanitize + rateLimit middleware, JWT + bcrypt + zxcvbn + refresh-token rotation.
- Parser: `/health`, `/parse` endpoints; extracts name/email/phone/skills/education/experience.
- Frontend: 11 pages (Landing, Auth, Dashboard, RoleSelect, UploadResume, ATSResult, Interview, HR, Admin), AuthContext, axios client, react-router.
- Docker compose stubs + Dockerfiles for server/client.
- 5 default roles seeded.

## Verified locally (smoke tested ✅)
- MongoDB connection (localhost:27017/hiremind)
- Redis ping (localhost:6379)
- `POST /api/auth/register` ✓
- `POST /api/auth/login` ✓
- `POST /api/auth/refresh` (rotates refresh token) ✓
- `GET /api/roles` (5 roles returned) ✓
- `POST /parse` (parser extracts skills/email/name) ✓
- Client `yarn build` succeeds (640 KB JS bundle)

## Backlog / future enhancements
- **P1** Wire a real Gemini API key + run E2E interview flow (start → answer → complete).
- **P2** Add backend integration tests (Jest + supertest).
- **P2** Code-split the React bundle (currently 640 KB; vite manualChunks).
- **P2** Add S3 storage for resumes (currently saved to `server/uploads/`).
- **P2** Add HR + Admin role accounts + RBAC E2E tests.
- **P2** BullMQ background workers for long-running Gemini calls.
- **P3** WebSocket for live interview progress.

## Tech-stack changes
None — matches user request exactly.

## 3rd-party integrations
- **Gemini 2.5 Flash** via `@google/generative-ai` (Node SDK, user-provided `GEMINI_API_KEY`).
- **MongoDB Atlas** (or local Mongo).
- **Redis** for BullMQ queues + lock service.
- **AWS S3** (optional, configurable via env).

## Key API endpoints
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | /api/health | – | Liveness |
| POST | /api/auth/register | – | Create account |
| POST | /api/auth/login | – | JWT login |
| POST | /api/auth/refresh | cookie | Rotate access token |
| POST | /api/auth/logout | cookie | Revoke refresh token |
| GET  | /api/roles | bearer | List roles |
| POST | /api/candidate/select-role | bearer | Pick role |
| POST | /api/candidate/upload-resume | bearer | Multipart PDF |
| POST | /api/candidate/calculate-ats | bearer | ATS scoring |
| POST | /api/interview/start | bearer | Begin interview (Gemini) |
| POST | /api/interview/answer | bearer | Submit answer (Gemini scoring) |
| POST | /api/interview/complete | bearer | Finalize + decision brief |
| GET  | /api/interview/history | bearer | Past interviews |
| GET  | /api/candidate/report | bearer | Download PDF |
