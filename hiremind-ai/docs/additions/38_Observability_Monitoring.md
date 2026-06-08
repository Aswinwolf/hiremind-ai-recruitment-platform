# SECTION 38 — Observability & Monitoring

> **Scope:** Logging, metrics, error tracking, and analytics dashboards. All endpoints below are **new** — they do not change any existing API contracts.

---

## 38.1 Application Logs (Winston + pino-pretty in dev)

```javascript
// server/config/logger.js
const winston = require("winston");
const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const dev = process.env.NODE_ENV !== "production";

const fmt = dev
  ? combine(colorize(), timestamp(), printf(i => `${i.timestamp} ${i.level} ${i.message} ${i.stack||""}`))
  : combine(timestamp(), errors({ stack:true }), json());

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: fmt,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});
module.exports = logger;
```

HTTP request logging:

```javascript
const morgan = require("morgan");
app.use(morgan(":method :url :status :res[content-length] - :response-time ms", {
  stream: { write: (m) => logger.info(m.trim()) }
}));
```

---

## 38.2 Error Tracking (Sentry)

```javascript
// server/config/sentry.js
const Sentry = require("@sentry/node");
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1, environment: process.env.NODE_ENV });
}
module.exports = Sentry;
```

```javascript
// server/index.js
const Sentry = require("./config/sentry");
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}
// ...routes...
if (process.env.SENTRY_DSN) app.use(Sentry.Handlers.errorHandler());

// Global error handler
app.use((err, req, res, _next) => {
  logger.error(err);
  if (err.message?.startsWith("CORS blocked")) return res.status(403).json({ message: err.message });
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});
```

Frontend Sentry init in `client/src/main.jsx`:

```javascript
import * as Sentry from "@sentry/react";
if (import.meta.env.VITE_SENTRY_DSN) Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, tracesSampleRate: 0.1 });
```

---

## 38.3 API Monitoring — Prometheus + Health

```javascript
// server/middleware/metrics.js
const promClient = require("prom-client");
promClient.collectDefaultMetrics();

const httpHist = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method","route","status"],
  buckets: [0.05,0.1,0.3,0.6,1,2,5]
});

const interviewCount = new promClient.Counter({
  name: "interviews_started_total",
  help: "Interviews started",
  labelNames:["role"]
});

function metricsMiddleware(req,res,next) {
  const end = httpHist.startTimer({ method: req.method, route: req.route?.path || req.path });
  res.on("finish", () => end({ status: res.statusCode }));
  next();
}

module.exports = { promClient, metricsMiddleware, interviewCount };
```

```javascript
// server/routes/health.js
const router = require("express").Router();
const { promClient } = require("../middleware/metrics");
router.get("/health", (_req,res) => res.json({ ok:true, uptime: process.uptime() }));
router.get("/metrics", async (_req,res) => { res.set("Content-Type", promClient.register.contentType); res.end(await promClient.register.metrics()); });
module.exports = router;
```

Mount in `index.js`: `app.use("/api", require("./routes/health"));`

---

## 38.4 Interview Analytics

```javascript
// server/routes/analytics.js
const Interview = require("../models/Interview");

router.get("/analytics/interviews", auth, requireAny("hr","admin"), async (_req, res) => {
  const last30 = new Date(Date.now() - 30*24*60*60*1000);
  const [total, completed, avgScore, byRole] = await Promise.all([
    Interview.countDocuments({ createdAt: { $gte: last30 } }),
    Interview.countDocuments({ status: "completed", completedAt: { $gte: last30 } }),
    Interview.aggregate([
      { $match: { status:"completed", completedAt:{ $gte:last30 } } },
      { $group: { _id: null, avg: { $avg: "$finalScores.finalScore" } } }
    ]),
    Interview.aggregate([
      { $match: { status:"completed", completedAt:{ $gte:last30 } } },
      { $group: { _id: "$selectedRole",
                  count: { $sum: 1 },
                  avg:   { $avg: "$finalScores.finalScore" },
                  rec:   { $sum: { $cond: [{ $in:["$recommendation",["Highly Recommended","Recommended"]] },1,0] } }
                }}
    ])
  ]);
  res.json({ window: "30d", total, completed, avgScore: Math.round(avgScore[0]?.avg||0), byRole });
});
```

---

## 38.5 ATS Analytics

```javascript
router.get("/analytics/ats", auth, requireAny("hr","admin"), async (_req, res) => {
  const data = await Candidate.aggregate([
    { $group: { _id: "$selectedRole",
                avg: { $avg: "$atsScore" },
                eligible: { $sum: { $cond: ["$isEligible", 1, 0] } },
                total: { $sum: 1 },
                topMissing: { $push: "$missingSkills" }
              }},
    { $project: {
        role: "$_id", avg: { $round: ["$avg", 1] }, eligible: 1, total: 1,
        eligibilityRate: { $round: [{ $multiply: [{ $divide: ["$eligible","$total"] }, 100] }, 1] }
    }}
  ]);
  res.json(data);
});
```

---

## 38.6 HR Analytics Dashboard

Frontend route `/hr/analytics` (React) calls the two endpoints above and renders with Recharts:

* Interviews completed per day (line)
* Avg final score per role (bar)
* Eligibility rate per role (bar)
* Top missing skills (treemap)

```jsx
// client/src/pages/HR/HRAnalytics.jsx (skeleton)
import { useEffect, useState } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function HRAnalytics() {
  const [iv, setIv] = useState(null), [ats, setAts] = useState([]);
  const token = localStorage.getItem("token");
  useEffect(() => {
    axios.get("/api/analytics/interviews", { headers:{ Authorization:`Bearer ${token}` }}).then(r=>setIv(r.data));
    axios.get("/api/analytics/ats",        { headers:{ Authorization:`Bearer ${token}` }}).then(r=>setAts(r.data));
  }, []);
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-6">HR Analytics</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Stat label="Interviews (30d)" value={iv?.total ?? "..."} />
        <Stat label="Completed" value={iv?.completed ?? "..."} />
        <Stat label="Avg Final Score" value={iv?.avgScore ?? "..."} />
      </div>
      <h2 className="font-semibold mb-2">Avg final score by role</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={iv?.byRole || []}><XAxis dataKey="_id" /><YAxis /><Tooltip /><Bar dataKey="avg" fill="#1E88E5" /></BarChart>
      </ResponsiveContainer>
      <h2 className="font-semibold mt-8 mb-2">ATS eligibility by role</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={ats}><XAxis dataKey="role" /><YAxis /><Tooltip /><Bar dataKey="eligibilityRate" fill="#27AE60" /></BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function Stat({label,value}){ return <div className="bg-white p-4 rounded-xl shadow"><div className="text-sm text-gray-500">{label}</div><div className="text-2xl font-bold">{value}</div></div>; }
```

---

## 38.7 Audit log query API

```javascript
router.get("/audit", auth, requireRole("admin"), async (req,res) => {
  const { action, userId, from, to, limit=100 } = req.query;
  const q = {};
  if (action) q.action = action;
  if (userId) q.userId = userId;
  if (from || to) q.at = { ...(from?{ $gte: new Date(from) }:{}), ...(to?{ $lte: new Date(to) }:{}) };
  const rows = await require("../models/AuditLog").find(q).sort({ at:-1 }).limit(Math.min(500, Number(limit)));
  res.json(rows);
});
```
