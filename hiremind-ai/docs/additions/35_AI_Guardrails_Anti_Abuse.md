# SECTION 35 — AI Guardrails & Anti-Abuse System

> **Scope:** A unified guardrail layer that runs on **every candidate-submitted answer** (Module 07 `/api/interview/answer`) and on **every Gemini-generated string** before it reaches the candidate. Implemented as middleware + `guardrails.js`. No existing route signature changes.

---

## 35.1 Threat Catalogue

| Threat                       | Detection                                       | Action                            |
| :--------------------------- | :---------------------------------------------- | :-------------------------------- |
| Prompt injection             | Regex + role-tag detection                      | Strip + flag `prompt_injection`   |
| Cheating (AI-generated)      | Heuristic burstiness + low n-gram diversity     | Flag `ai_generated`               |
| Copy-paste                   | Paste event count + low typing entropy          | Flag `paste_detected`             |
| Extremely short              | `< 15 chars` or `< 5 words`                     | Flag `too_short` + cap scores     |
| Offensive content            | Wordlist + Gemini binary classifier             | Flag `offensive` + reject         |
| AI manipulation              | "Ignore previous", "act as", "system:" patterns | Strip + flag `prompt_injection`   |

---

## 35.2 Middleware: Input Sanitization

```javascript
// server/middleware/sanitize.js
const xss   = require("xss");
const mongoSanitize = require("express-mongo-sanitize");

module.exports = [
  mongoSanitize({ replaceWith: "_" }),
  (req, _res, next) => {
    if (req.body && typeof req.body === "object") {
      for (const k of Object.keys(req.body)) {
        if (typeof req.body[k] === "string") req.body[k] = xss(req.body[k], { whiteList: {}, stripIgnoreTag: true });
      }
    }
    next();
  }
];
```

Apply in `index.js`:

```javascript
const sanitize = require("./middleware/sanitize");
app.use(sanitize);
```

---

## 35.3 Input guards (per answer)

```javascript
// server/services/guardrails.js
const INJECTION_PATTERNS = [
  /ignore (all )?(previous|above) (instructions|prompts)/i,
  /you are now/i,
  /act as (a |an )?(system|admin|developer)/i,
  /\bsystem\s*:/i,
  /<\s*\/?\s*system\s*>/i,
  /developer\s*mode/i,
  /jailbreak/i,
  /reveal (the )?(system )?prompt/i,
];

const OFFENSIVE = [
  // base wordlist — extend with your locale
  "fuck","shit","bitch","asshole","bastard","slur1","slur2"
];

function scanInjection(text="") {
  return INJECTION_PATTERNS.some(re => re.test(text));
}
function scanOffensive(text="") {
  const t = text.toLowerCase();
  return OFFENSIVE.some(w => new RegExp(`\\b${w}\\b`,"i").test(t));
}
function scanTooShort(text="") {
  const w = text.trim().split(/\s+/).filter(Boolean);
  return text.trim().length < 15 || w.length < 5;
}

// Burstiness ~ stddev of sentence length / mean
function scanAIGenerated(text="") {
  const sentences = text.split(/[.!?]+/).map(s=>s.trim()).filter(Boolean);
  if (sentences.length < 4) return false;
  const lens = sentences.map(s => s.split(/\s+/).length);
  const mean = lens.reduce((a,b)=>a+b,0)/lens.length;
  const variance = lens.reduce((a,b)=>a+Math.pow(b-mean,2),0)/lens.length;
  const stddev = Math.sqrt(variance);
  const burstiness = stddev / (mean||1);
  // AI text: low burstiness (very uniform) + long average
  return mean > 18 && burstiness < 0.25;
}

function stripInjection(text="") {
  let t = text;
  INJECTION_PATTERNS.forEach(re => { t = t.replace(re, ""); });
  return t.trim();
}

function runOutputGuards({ question, answer }) {
  const flags = [];
  if (scanInjection(answer)) flags.push("prompt_injection");
  if (scanOffensive(answer)) flags.push("offensive");
  if (scanTooShort(answer))  flags.push("too_short");
  if (scanAIGenerated(answer)) flags.push("ai_generated");
  return flags;
}

module.exports = { scanInjection, scanOffensive, scanTooShort, scanAIGenerated, stripInjection, runOutputGuards };
```

---

## 35.4 Paste / Typing-entropy signal (frontend → backend)

```javascript
// client/src/hooks/useTypingSignal.js
import { useEffect, useRef, useState } from "react";
export function useTypingSignal(textareaRef) {
  const [signal, setSignal] = useState({ pasteCount:0, keystrokes:0, sessionMs:0 });
  const start = useRef(Date.now());
  useEffect(() => {
    const el = textareaRef.current; if (!el) return;
    const onPaste = () => setSignal(s => ({...s, pasteCount: s.pasteCount+1}));
    const onKey   = () => setSignal(s => ({...s, keystrokes: s.keystrokes+1}));
    el.addEventListener("paste", onPaste);
    el.addEventListener("keydown", onKey);
    return () => { el.removeEventListener("paste", onPaste); el.removeEventListener("keydown", onKey); };
  }, [textareaRef]);
  useEffect(() => { const t = setInterval(()=>setSignal(s=>({...s, sessionMs: Date.now()-start.current})), 1000); return ()=>clearInterval(t); }, []);
  return signal;
}
```

The client sends `{ pasteCount, keystrokes, sessionMs }` alongside the answer. Backend logic:

```javascript
// server/routes/interview.js (in /answer)
const { pasteCount=0, keystrokes=0, sessionMs=0 } = req.body.signal || {};
const charsPerKey = keystrokes>0 ? answer.length / keystrokes : 0;
const flags = [];
if (pasteCount >= 1)                     flags.push("paste_detected");
if (charsPerKey > 4 && keystrokes < 25)  flags.push("paste_detected");
// merge with model-side flags later
```

---

## 35.5 Offensive content rejection

```javascript
// server/routes/interview.js (top of /answer)
const { scanOffensive, scanInjection, stripInjection } = require("../services/guardrails");
if (scanOffensive(answer)) {
  return res.status(400).json({ message: "Your answer contains inappropriate language. Please rephrase." });
}
const cleanAnswer = scanInjection(answer) ? stripInjection(answer) : answer;
```

The **stripped** version goes to Gemini; the **original** (with `[REDACTED]` placeholder) is stored for audit.

---

## 35.6 Gemini output guard (anti-leak)

```javascript
// server/services/geminiSafeCall.js
const { geminiModel } = require("../config/gemini");

const FORBIDDEN_OUT = [
  /api[_\s-]?key/i, /AIza[0-9A-Za-z\-_]{20,}/, /sk-[a-zA-Z0-9]{20,}/,
  /BEGIN (RSA|OPENSSH) PRIVATE KEY/, /mongodb\+srv:\/\//
];

async function safeGenerate(prompt) {
  const r = await geminiModel.generateContent(prompt);
  let text = r.response.text();
  for (const re of FORBIDDEN_OUT) text = text.replace(re, "[REDACTED]");
  return { text, raw: r };
}
module.exports = { safeGenerate };
```

Use `safeGenerate` everywhere we used to call `geminiModel.generateContent` directly for **user-facing** strings (interview questions, summaries). Scoring calls (JSON only) keep the original direct call.

---

## 35.7 Rate-limited abuse counter

If a single user accumulates ≥ 3 `prompt_injection` flags in one interview, automatically:

* Mark `interview.flags = ["ABUSIVE"]`
* Force `recommendation = "Needs Improvement"`
* Send audit log entry (§36 audit logs)

```javascript
// in /api/interview/answer, after pushing flags
const totalInjections = interview.questions.flatMap(q=>q.scores?.redFlags||[]).filter(f=>f==="prompt_injection").length;
if (totalInjections >= 3) {
  interview.flags = Array.from(new Set([...(interview.flags||[]), "ABUSIVE"]));
}
```
