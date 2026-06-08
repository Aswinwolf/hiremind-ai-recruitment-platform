# SECTION 29 — End-to-End Interview Workflow Diagrams

> **Scope:** Visualizes how data, control, and AI calls flow across every module documented in Sections 1–28. No existing module is modified — these diagrams document the **already-defined** behavior at a production-architecture level.

---

## 29.1 Complete Workflow (Candidate Journey)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CANDIDATE LIFECYCLE                              │
└──────────────────────────────────────────────────────────────────────────┘

  [Register] ─► [Login] ─► [Select Role] ─► [Upload Resume]
                                                  │
                                                  ▼
                              ┌──────────────────────────────────┐
                              │  Python Parser Microservice      │
                              │  (Module 04 — pdfplumber)        │
                              └──────────────────────────────────┘
                                                  │
                                                  ▼
                              ┌──────────────────────────────────┐
                              │  ATS Score Engine (Module 05)    │
                              │  matched/required × 100          │
                              └──────────────────────────────────┘
                                                  │
                          ┌───────────────────────┴────────────────────────┐
                          ▼                                                ▼
                  score ≥ threshold                                   score < threshold
                          │                                                │
                          ▼                                                ▼
              [Eligibility Check OK]                          [Improve Skills Screen]
                          │                                                │
                          ▼                                                ▼
              [Interview Lock acquired]                        [Resume Improvement → §41.9]
                          │
                          ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │           AI INTERVIEW ENGINE (Module 07) — Gemini 2.5 Flash         │
   │                                                                      │
   │   Round 1 Technical   →  3 Qs  (Resume-based + Role-based)          │
   │   Round 2 Resume Deep →  3 Qs  (Projects & Experience)              │
   │   Round 3 Behavioral  →  3 Qs  (STAR-format prompts)                │
   │                                                                      │
   │   Per question: Voice answer → Real-time scoring → Persist          │
   └──────────────────────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │      AI Evaluation Framework (§32) + Behavioral Framework (§33)     │
   │      Guardrails (§35) run on every answer                            │
   └──────────────────────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                  [Final Evaluation Engine — Module 14]
                                                  │
                                                  ▼
   [Recommendation Engine (Module 15)] → [PDF Report (Module 16)] → [Candidate Dashboard]
                                                  │
                                                  ▼
                              [HR Dashboard / Ranking / ATS Analytics]
```

---

## 29.2 System Flow (Services & Ports)

```
┌─────────────────────────┐       HTTPS         ┌────────────────────────────┐
│  React Client  :3000    │ ◄────────────────► │  Express API   :5000       │
│  (Vite)                 │   JWT (Access)      │  Node 20+                  │
│                         │   Refresh cookie    │                            │
└─────────────────────────┘                     └────────────────────────────┘
                                                          │
                ┌─────────────────────────────────────────┼─────────────────────┐
                │                                         │                     │
                ▼                                         ▼                     ▼
  ┌─────────────────────────┐         ┌────────────────────────┐    ┌────────────────────┐
  │ MongoDB Atlas (TLS)     │         │ Redis (cache + queue)  │    │ Python Parser:5001 │
  │ replica set, indexes    │         │ BullMQ workers         │    │ Flask + pdfplumber │
  └─────────────────────────┘         └────────────────────────┘    └────────────────────┘
                                                  │
                                                  ▼
                                       ┌──────────────────────┐
                                       │ Gemini 2.5 Flash API │
                                       │ Google AI Studio     │
                                       └──────────────────────┘

  ┌─────────────────────────┐                                     ┌────────────────────┐
  │ AWS S3 / CloudFront CDN │ ◄── resume + report uploads ───────│ Express API        │
  └─────────────────────────┘                                     └────────────────────┘
```

**Port map (local dev):**

| Service          | Port  | Purpose                       |
| :--------------- | :---- | :---------------------------- |
| React (Vite)     | 3000  | Frontend dev server           |
| Express API      | 5000  | REST API + auth + uploads     |
| Python Parser    | 5001  | Resume parsing microservice   |
| MongoDB          | 27017 | Database (Atlas in prod)      |
| Redis            | 6379  | Cache + BullMQ queue          |

---

## 29.3 Data Flow (Sequence — one interview)

```
Candidate           React           Express API         Mongo        Gemini        Redis
   │                  │                  │                │            │             │
   │── POST /login ──►│                  │                │            │             │
   │                  │── /auth/login ─►│                │            │             │
   │                  │                  │── User.find ─►│            │             │
   │                  │                  │◄── ok ────────│            │             │
   │                  │                  │── sign JWT+RT │            │             │
   │                  │◄── tokens ──────│                │            │             │
   │                                                                                  │
   │── Upload PDF ───►│── multipart ────►│                │            │             │
   │                  │                  │── parser:5001 ──────────────────────────►│ (Python)
   │                  │                  │◄── parsed JSON ────────────────────────── │
   │                  │                  │── Candidate.save ►│         │             │
   │                                                                                  │
   │── Start Interview ►                  │── acquire LOCK ───────────────────────────►│
   │                  │                  │── generateQuestions(3 rounds) ──►│         │
   │                  │                  │◄── 9 questions ────────────────── │         │
   │                  │                  │── Interview.save ►│              │         │
   │                  │◄── 9 Qs ────────│                │                  │         │
   │                                                                                  │
   │── Answer Q1 ────►│── /answer ──────►│── guardrails (§35) ─┐                      │
   │                  │                  │◄────────────────────┘                      │
   │                  │                  │── evaluateAnswer ───────────────►│         │
   │                  │                  │◄── 6-dim scores ─────────────────│         │
   │                  │                  │── Interview.update►│                      │
   │                  │◄── scores ──────│                │                  │         │
   │                                  (repeat for Q2..Q9)                            │
   │                                                                                  │
   │── Complete ─────►│── /complete ────►│── analyzePsych+behavioral ───►│            │
   │                  │                  │── recruiterDecisionEngine ─►│              │
   │                  │                  │── Interview.finalize ►│                    │
   │                  │                  │── enqueue PDF report ─────────────────────►│ (BullMQ)
   │                  │                  │── release LOCK ──────────────────────────► │
   │                  │◄── finalScore ───│                                            │
   │                                                                                  │
   │── Download PDF ─►│── /report ──────►│── PDFKit stream ─►│                        │
   │◄── PDF ──────────│                  │                                            │
```

---

## 29.4 Round → Module Mapping (for traceability)

| Phase              | Original Module | New Section Reference            |
| :----------------- | :-------------- | :------------------------------- |
| Register/Login     | Module 01       | §36 RBAC + §36 Refresh tokens    |
| Role Selection     | Module 02       | —                                |
| Resume Upload      | Module 03       | §36 Secure upload validation     |
| Resume Parse       | Module 04       | §37 Queue offload (optional)     |
| ATS Scoring        | Module 05       | §39 Aggregation pipelines        |
| Eligibility        | Module 06       | §30 Locking                      |
| AI Interview       | Module 07       | §31 Question gen, §32 evaluation |
| Behavioral Round   | Module 08       | §33 Behavioral framework         |
| Psych Indicators   | Module 09       | §40 Prompt: psych                |
| Voice Interview    | Module 10       | §35 anti-cheat (paste/short)     |
| Real-Time Scoring  | Module 11       | §32 Evaluation                   |
| Recording          | Module 12       | §37 S3                           |
| Feedback           | Module 13       | —                                |
| Final Evaluation   | Module 14       | §34 Decision Intelligence        |
| Recommendation     | Module 15       | §34 Hiring confidence            |
| PDF Report         | Module 16       | §37 Worker offload               |
| Candidate Dash     | Module 17       | —                                |
| HR Dash            | Module 18       | §38 HR analytics                 |
| Ranking            | Module 19       | §39 Ranking optimization         |
| Admin Panel        | Module 20       | §36 RBAC                         |

> All diagrams above describe the **already-implemented** system. Subsequent sections specify *how to harden, scale, and observe* it without changing its public contracts.
