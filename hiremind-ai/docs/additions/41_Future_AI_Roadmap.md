# SECTION 41 — Future AI Roadmap

> **Scope:** Practical, phased roadmap aligned with the existing MERN + Gemini architecture. Each item is sized as **(S/M/L)** effort, with the **minimal viable** integration path so it can ship incrementally without re-architecting v1.

---

## 41.1 AI Coding Assessment **(M)**

* **Goal:** Replace one of the 3 technical questions with a *live coding* problem solved in an embedded editor.
* **Stack additions:** Monaco Editor (`@monaco-editor/react`), `vm2` sandbox or Judge0 self-host API for Node/Python execution.
* **Pipeline:**
  1. Gemini generates a coding problem + hidden test cases (JSON).
  2. Candidate types code → run against test cases server-side (timeout 5s, memory cap).
  3. Gemini evaluates: correctness (deterministic), style + complexity (LLM scoring).
* **Risk controls:** sandbox isolation, no network, no fs.

```javascript
// server/services/codeEvaluator.js  (sketch)
async function runUserCode(lang, source, testCases) {
  // POST to local Judge0 instance, return { passed, failed, runtimeMs }
}
```

---

## 41.2 Live Video Interview Analysis **(L)**

* **Goal:** Capture webcam during interview and analyse facial expressions / engagement / eye contact.
* **MVP path:** WebRTC `getUserMedia` → record locally → on submit, upload to S3 → backend worker calls **face-api.js** (CPU) or **AWS Rekognition** for emotion + attention scores.
* **Privacy:** opt-in toggle, raw video deleted after analysis, only derived metrics stored on `Interview.videoSignals`.

---

## 41.3 Emotion Detection **(M)**

* **Goal:** Per-question emotion overlay (happy / neutral / stressed / confused).
* **Voice signal:** Web Audio API → pitch + energy + speech rate; cheap heuristics.
* **Face signal:** browser-side `face-api.js` (no upload) → counts per emotion every 2s → only **aggregates** sent.
* **Storage:** `Interview.emotionSignals = [{ qIndex, dominant, byClass }]`.
* **Use:** feeds §34 hiring-confidence as a *minor* multiplier (±5%).

---

## 41.4 RAG Integration **(M)**

* **Goal:** Ground questions and evaluation in the **company's** real job descriptions, runbooks, and past interviewer rubrics.
* **Stack:** MongoDB Atlas Vector Search (free tier) — no extra service.
* **Pipeline:**
  1. Admin uploads JD/rubric docs (PDF, MD).
  2. Worker chunks → embeds via **text-embedding-004** (Gemini) → stores `{vector, content, jobId}`.
  3. Question generation prompt is prepended with the top-3 nearest chunks per query.

```javascript
// server/services/rag.js (sketch)
async function retrieve(jobId, query, k=3) {
  return db.collection("docs_vec").aggregate([
    { $vectorSearch: { index: "docs_vec_idx", path:"vector", queryVector: await embed(query), numCandidates: 100, limit: k, filter:{ jobId } } }
  ]).toArray();
}
```

---

## 41.5 Multi-Language Interviews **(M)**

* **Goal:** Conduct interviews in Hindi/Spanish/French/etc.
* **Tech:** Web Speech API `lang = "hi-IN"` etc. for STT; Gemini supports multilingual natively.
* **Prompt switch:** add `Reply in {locale}.` to every prompt; persist `interview.locale`.
* **Scoring fairness:** evaluation rubric translated and frozen per locale.
* **Constraints:** browser TTS quality varies — fallback to **gTTS** server-side if quality is poor.

---

## 41.6 AI Recruiter Copilot **(L)**

* **Goal:** Inline chat panel inside the HR Dashboard that answers recruiter questions over the candidate pool.
* **Example queries:**
  * *"Show me the top 5 Python candidates with no Kubernetes gap, sorted by HCS."*
  * *"Draft an outreach email for candidate X based on their report."*
* **Stack:** Gemini function-calling → tools = `[searchCandidates, getInterview, summarize, draftEmail]`.
* **Security:** RBAC-gated; copilot can only see candidates the recruiter is authorized to read.

---

## 41.7 Company-Specific Interview Customization **(S)**

* **Goal:** Each company defines its **own** rubrics, dimensions, and weighting.
* **Schema additions:** `Company` model + `Rubric` model (additive).
* **Effect:** `evaluationService` reads `companyId.rubric` from JWT → applies custom dimension list and final-score formula.
* **Backwards-compat:** if no rubric set, defaults to the v1 formula.

---

## 41.8 Job Description Generator **(S)**

* **Goal:** Recruiter types a role name + 5 bullets → Gemini drafts a full JD (mission, responsibilities, requirements, nice-to-have, benefits).
* **Endpoint:** `POST /api/hr/jd/generate` with body `{ title, mustHaves, niceToHaves, seniority, location }`.
* **Output JSON:** stored in `JobDescription` collection and linked to a `Role` (existing schema).
* **Prompt outline:**

```javascript
function buildJDPrompt({ title, mustHaves, niceToHaves, seniority, location, companyVoice="neutral" }) {
  return `You are an HR copywriter. Draft a JD for "${title}" (${seniority}, ${location}).
Must-haves: ${mustHaves.join(", ")}
Nice-to-haves: ${niceToHaves.join(", ")}
Tone: ${companyVoice}.

Return ONLY valid JSON:
{
  "title": "",
  "summary": "",
  "responsibilities": ["..."],
  "requirements":     ["..."],
  "niceToHaves":      ["..."],
  "benefits":         ["..."]
}`;
}
```

---

## 41.9 Resume Improvement Assistant **(S)**

* **Goal:** After an unsuccessful ATS check (Module 06), Gemini explains *exactly* how to improve the candidate's resume.
* **Endpoint:** `POST /api/candidate/resume-improvement`.
* **Inputs:** `parsedResume`, `missingSkills`, `selectedRole`.
* **Output:**

```json
{
  "addBullets":   [ "Quantify your projects with metrics (users, latency)..." ],
  "rewriteLines": [ { "from":"...", "to":"..." } ],
  "skillsToShow": [ "Kubernetes basics — add a section on container orchestration" ],
  "formatting":   [ "Use a single column", "Move skills above experience" ]
}
```

* **UI:** rendered in the existing `ATSResult` page when `isEligible=false`.

---

## 41.10 Phased delivery plan

| Phase | Window  | Includes                                                     |
| :---- | :------ | :----------------------------------------------------------- |
| 1     | 0–2 wk  | §41.8 JD generator, §41.9 Resume assistant, §41.7 Custom rubrics |
| 2     | 2–6 wk  | §41.1 Coding assessment, §41.5 Multi-language                |
| 3     | 6–10 wk | §41.4 RAG, §41.6 Recruiter Copilot                           |
| 4     | 10–14 wk| §41.3 Emotion detection                                       |
| 5     | 14–20 wk| §41.2 Live video interview analysis                          |
