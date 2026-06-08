# SECTION 42 — LOCAL SETUP GUIDE (Windows + VS Code)

> **Scope:** A from-scratch, copy-paste runnable setup for the **complete** HireMind AI project on a fresh Windows machine. Mac/Linux commands are noted where they differ.

---

## 42.1 Prerequisites

Install (one-time):

| Tool          | Version  | Download                                                                  |
| :------------ | :------- | :------------------------------------------------------------------------ |
| Node.js       | **20 LTS** | https://nodejs.org/en/download — includes npm                            |
| Python        | **3.11+**  | https://www.python.org/downloads/windows/  *(check "Add Python to PATH")* |
| Git           | latest   | https://git-scm.com/download/win                                          |
| VS Code       | latest   | https://code.visualstudio.com                                             |
| MongoDB Atlas | free tier| https://cloud.mongodb.com (or install MongoDB Community Server locally)   |
| Redis (optional, for queues/cache) | 7.x | **Memurai** for Windows (https://www.memurai.com/get-memurai) **or** WSL `sudo apt install redis-server` |
| Postman or Insomnia | latest | https://www.postman.com                                                   |

Recommended VS Code extensions: *ESLint*, *Prettier*, *Tailwind CSS IntelliSense*, *DotENV*, *Python*, *Pylance*, *MongoDB for VS Code*.

---

## 42.2 Get the project

```powershell
# Powershell
git clone https://github.com/<your-org>/hiremind-ai.git
cd hiremind-ai
code .
```

Folder layout you should see:

```
hiremind-ai/
├── client/             # React (Vite) frontend
├── server/             # Node.js + Express API
├── parser/             # Python (Flask) resume parser
├── docker/             # docker-compose.yml
├── docs/               # implementation guide + this setup guide
└── .env.example
```

---

## 42.3 Get API keys

### Gemini 2.5 Flash API key (FREE)

1. Go to **https://aistudio.google.com**.
2. Sign in with your Google account.
3. Click **Get API key** → **Create API key in new project**.
4. Copy the key. It looks like `AIzaSy...`.

### MongoDB Atlas (FREE 512 MB)

1. Sign up at **https://cloud.mongodb.com**.
2. Create **Project → Build a Cluster → M0 Free Tier**.
3. **Database Access** → add a user (`hiremind` / strong password).
4. **Network Access** → **Add IP** → `0.0.0.0/0` (dev only — restrict in prod).
5. **Connect → Drivers → Node.js** → copy the connection string. It looks like:
   `mongodb+srv://hiremind:<password>@cluster0.xxxxx.mongodb.net/hiremind?retryWrites=true&w=majority`
6. Replace `<password>` with your real password. Append the database name `/hiremind`.

### Optional: Tavily (used in some roadmap items in §41.4 RAG)

Free at **https://app.tavily.com**.

---

## 42.4 Create the `.env` files

Copy the templates:

```powershell
copy .env.example .env
copy server\.env.example server\.env
copy client\.env.example client\.env
copy parser\.env.example parser\.env
```

Then fill them with real values:

### `server/.env`

```dotenv
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://hiremind:YOURPASS@cluster0.xxxxx.mongodb.net/hiremind?retryWrites=true&w=majority

# Auth (must be ≥ 32 chars)
JWT_SECRET=replace_me_with_a_long_random_string_min_32_chars
JWT_REFRESH_SECRET=replace_me_with_ANOTHER_long_random_string

# Gemini
GEMINI_API_KEY=AIzaSy_your_real_gemini_key

# Parser microservice
PARSER_URL=http://localhost:5001

# Optional integrations
TAVILY_API_KEY=
REDIS_URL=
SENTRY_DSN=
AWS_S3_BUCKET=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# CORS
CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=info
```

### `client/.env`

```dotenv
VITE_API_BASE_URL=http://localhost:5000
VITE_SENTRY_DSN=
```

### `parser/.env`

```dotenv
PORT=5001
MAX_UPLOAD_MB=5
```

> **NEVER** commit any of these `.env` files. Only `.env.example` is committed.

---

## 42.5 Install dependencies

Open **three PowerShell terminals** in VS Code (`Ctrl+\` then click `+`).

### Terminal 1 — server (Node)

```powershell
cd server
npm install
```

### Terminal 2 — client (React + Vite)

```powershell
cd client
npm install
```

### Terminal 3 — parser (Python)

```powershell
cd parser
python -m venv venv
.\venv\Scripts\Activate.ps1            # Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
```

> If PowerShell blocks `Activate.ps1`, run once as admin:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

---

## 42.6 Initialise the database

Seed default roles **and** create indexes (idempotent — safe to re-run):

```powershell
cd server
npm run seed:roles
npm run db:indexes
```

(These npm scripts are defined in `server/package.json`; they wrap the scripts in `server/scripts/`.)

---

## 42.7 Run the three services

### Terminal 1 — server

```powershell
cd server
npm run dev
# expected: "Server running on port 5000" + "MongoDB connected"
```

### Terminal 2 — client

```powershell
cd client
npm run dev
# expected: "Local: http://localhost:3000/"
```

### Terminal 3 — parser

```powershell
cd parser
.\venv\Scripts\Activate.ps1
python app.py
# expected: " * Running on http://127.0.0.1:5001"
```

Open **http://localhost:3000** in Chrome or Edge (required for voice).

---

## 42.8 First-run smoke test

1. **Register** → create candidate account.
2. **Select role** → MERN Developer.
3. **Upload resume** → any PDF (≤ 5 MB).
4. **ATS Score** → should display a number + missing skills.
5. **Start Interview** → click *Start Speaking*, allow microphone, answer one question, click *Submit*.
6. **Complete** → finish all 9 questions.
7. **Download Report** → PDF should open.

To test HR/admin flows, manually promote a user in MongoDB:

```js
// MongoDB shell
use hiremind
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })
```

Then log in → visit `/admin` and `/hr`.

---

## 42.9 Common troubleshooting

| Symptom                                                            | Cause / Fix                                                                                                |
| :----------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `MongoServerError: bad auth`                                       | Wrong password or `<password>` left in URI. Re-encode special chars.                                       |
| `ECONNREFUSED 127.0.0.1:5001` on upload                            | Parser service not running. Start Terminal 3.                                                              |
| `GoogleGenerativeAI Error: API key invalid`                        | Wrong/expired `GEMINI_API_KEY`. Generate new at aistudio.google.com.                                       |
| `CORS blocked: http://localhost:3000`                              | Add origin to `CORS_ORIGINS` in `server/.env`.                                                             |
| `Speech recognition not supported`                                 | Use Chrome or Edge — Firefox/Safari do not implement Web Speech API.                                       |
| `Only PDF files are allowed`                                       | Upload must be `.pdf` with valid PDF magic bytes.                                                          |
| `EACCES: permission denied uploads/`                               | `mkdir uploads` in `server/`. Linux: `chmod 755 uploads`.                                                  |
| `cannot find module '@google/generative-ai'`                       | Re-run `npm install` in `server/`.                                                                         |
| Frontend shows `Network Error`                                     | Backend not on port 5000 OR `VITE_API_BASE_URL` mismatch.                                                  |
| `pdfplumber.PDFSyntaxError`                                        | Resume PDF is scanned/encrypted. Convert to text-based PDF first.                                          |
| Windows Defender blocks `node` / `python`                          | Allow once — your antivirus may flag local dev servers.                                                    |
| Token expired after 15 min                                         | Frontend must call `/api/auth/refresh` — already wired in `src/services/api.js`.                           |
| `Activate.ps1 cannot be loaded`                                    | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` (run once).                         |
| Atlas IP whitelist denies you                                      | Add your IP under **Network Access** in Atlas dashboard.                                                   |

---

## 42.10 (Optional) Run everything with Docker

If you have **Docker Desktop**:

```powershell
cd docker
docker compose up --build
```

Services:

* Frontend: http://localhost:3000
* API: http://localhost:5000
* Parser: http://localhost:5001
* Mongo: localhost:27017
* Redis: localhost:6379

To stop: `docker compose down`. To wipe DB volume: `docker compose down -v`.

---

## 42.11 Project npm scripts (server)

| Script               | What it does                                       |
| :------------------- | :------------------------------------------------- |
| `npm run dev`        | Start API with `nodemon`                           |
| `npm start`          | Production-mode start (`node index.js`)            |
| `npm run seed:roles` | Seeds the 5 default roles                          |
| `npm run db:indexes` | Creates all production indexes (§39.1)             |
| `npm run lint`       | ESLint check                                       |
| `npm test`           | Jest unit tests (sanity tests included)            |

## 42.12 Project npm scripts (client)

| Script         | What it does                       |
| :------------- | :--------------------------------- |
| `npm run dev`  | Vite dev server with HMR           |
| `npm run build`| Production build to `client/dist/` |
| `npm run preview` | Serve the prod build locally    |

## 42.13 Production checklist (before going live)

* [ ] Strong, unique `JWT_SECRET` and `JWT_REFRESH_SECRET` (32+ chars).
* [ ] Restrict Atlas IP whitelist to your servers only.
* [ ] Set `NODE_ENV=production`.
* [ ] Configure `REDIS_URL`, `AWS_S3_BUCKET`, `SENTRY_DSN`.
* [ ] Replace local `/uploads/` with S3 (§37.3).
* [ ] Run `npm run db:indexes` against the production database.
* [ ] Apply Helmet CSP `script-src` with **nonces** (remove `unsafe-inline`).
* [ ] Verify HTTPS everywhere; force `secure` flag on cookies.
* [ ] Enable Sentry frontend + backend.
* [ ] Set up Prometheus scraping `/api/metrics`.

---

You now have a fully runnable HireMind AI development environment. For module-by-module behavior, see the original guide (Sections 1–28). For production hardening details, see Sections 29–41.
