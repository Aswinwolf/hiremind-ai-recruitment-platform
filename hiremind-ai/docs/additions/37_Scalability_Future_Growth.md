# SECTION 37 — Scalability & Future Growth Architecture

> **Scope:** Reference architecture for moving from a single-machine MERN deployment (Sections 1, 27) to a multi-node, queue-backed, horizontally-scaled system. All additions are **optional in dev** — the system continues to work without Redis/S3.

---

## 37.1 Redis

**Purpose:** caching, BullMQ queue backbone, lock store (§30), anti-repeat hashes (§31), refresh-token deny-list, rate-limit store.

```javascript
// server/config/redis.js
const IORedis = require("ioredis");
let client = null;
if (process.env.REDIS_URL) {
  client = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  client.on("error", (e) => console.warn("Redis error:", e.message));
  console.log("Redis: connected");
} else {
  console.log("Redis: not configured (fallback to in-memory)");
}
module.exports = client;
```

Used by services in §30, §31; safe to be `null` in dev.

---

## 37.2 BullMQ — background job queue

```javascript
// server/queues/index.js
const { Queue, Worker, QueueScheduler } = require("bullmq");
const redis = require("../config/redis");

let queues = {}, workers = {}, schedulers = {};

if (redis) {
  for (const name of ["reports", "stale-sweeper", "parser", "embeddings"]) {
    queues[name]     = new Queue(name, { connection: redis });
    schedulers[name] = new QueueScheduler(name, { connection: redis });
  }
} else {
  console.log("BullMQ disabled (no REDIS_URL). Falling back to inline execution.");
}

module.exports = { queues, workers, redis };
```

```javascript
// server/workers/reportWorker.js
const { Worker } = require("bullmq");
const redis = require("../config/redis");
const Interview = require("../models/Interview");
const Candidate = require("../models/Candidate");
const { generateReport } = require("../services/reportService");

if (redis) {
  new Worker("reports", async job => {
    const { interviewId } = job.data;
    const iv  = await Interview.findById(interviewId);
    const ca  = await Candidate.findById(iv.candidateId);
    const fp  = await generateReport(ca, iv);
    iv.reportPath = fp; await iv.save();
    return fp;
  }, { connection: redis, concurrency: 4 });
  console.log("reportWorker running");
}
```

Enqueue from `/api/interview/complete`:

```javascript
const { queues } = require("../queues");
if (queues.reports) await queues.reports.add("generate", { interviewId: interview._id.toString() });
```

When Redis is absent, the existing inline `await generateReport(...)` still runs.

---

## 37.3 AWS S3 (resumes + reports)

```javascript
// server/services/s3Service.js
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");

let s3 = null;
if (process.env.AWS_S3_BUCKET) {
  s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  });
}

async function upload(localPath, key) {
  if (!s3) return null;
  const body = await fs.promises.readFile(localPath);
  await s3.send(new PutObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key, Body: body, ContentType: "application/pdf" }));
  return key;
}

async function signedUrl(key, ttlSec=300) {
  if (!s3) return null;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key }), { expiresIn: ttlSec });
}

module.exports = { s3, upload, signedUrl };
```

Resume uploads now write to `/uploads/.../` locally **and** mirror to `s3://bucket/resumes/<userId>/<uuid>.pdf`. The candidate dashboard download URL becomes a 5-minute pre-signed URL when S3 is enabled.

---

## 37.4 CDN

* Frontend (Vercel/CloudFront) serves static assets globally.
* PDF report URLs sit behind CloudFront with `Cache-Control: private, max-age=60` and signed cookie auth.
* CDN origin = S3 bucket (private; OAC enabled).

---

## 37.5 Horizontal Scaling

| Layer            | Strategy                                                                          |
| :--------------- | :-------------------------------------------------------------------------------- |
| API (Express)    | Stateless. Behind ALB. `N` replicas, sticky session **not required**.             |
| Worker (BullMQ)  | `M` independent replicas; competing consumers for `reports`, `parser` queues.     |
| Parser (Python)  | Stateless. Behind ALB. Auto-scale on CPU.                                         |
| MongoDB          | Atlas replica set; reads from secondaries for HR analytics.                       |
| Redis            | Atlas Redis or ElastiCache; cluster mode for >100k concurrent interviews.         |
| Sessions         | JWT access (stateless) + refresh in Mongo (already designed in §36.7).            |

Sticky-session requirements are zero because all state is in Mongo/Redis.

---

## 37.6 Docker

```dockerfile
# server/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5000
CMD ["node","index.js"]
```

```dockerfile
# parser/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5001
CMD ["python","app.py"]
```

```dockerfile
# client/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```yaml
# docker/docker-compose.yml
version: "3.9"
services:
  mongo:   { image: mongo:7,           ports: ["27017:27017"], volumes: [mongo-data:/data/db] }
  redis:   { image: redis:7-alpine,    ports: ["6379:6379"]   }
  parser:  { build: ../parser,         ports: ["5001:5001"],   env_file: ../parser/.env }
  server:  { build: ../server,         ports: ["5000:5000"],   env_file: ../server/.env,  depends_on: [mongo, redis, parser] }
  client:  { build: ../client,         ports: ["3000:80"],     depends_on: [server] }
volumes:
  mongo-data:
```

Run: `cd docker && docker compose up --build`.

---

## 37.7 Kubernetes Readiness

```yaml
# k8s/server-deployment.yaml (excerpt)
apiVersion: apps/v1
kind: Deployment
metadata: { name: hiremind-server }
spec:
  replicas: 3
  selector: { matchLabels: { app: hiremind-server } }
  template:
    metadata: { labels: { app: hiremind-server } }
    spec:
      containers:
      - name: server
        image: ghcr.io/yourorg/hiremind-server:latest
        ports: [{ containerPort: 5000 }]
        envFrom: [{ secretRef: { name: hiremind-secrets } }]
        readinessProbe: { httpGet: { path: /api/health, port: 5000 }, initialDelaySeconds: 5, periodSeconds: 5 }
        livenessProbe:  { httpGet: { path: /api/health, port: 5000 }, initialDelaySeconds: 30, periodSeconds: 15 }
        resources:
          requests: { cpu: "100m", memory: "256Mi" }
          limits:   { cpu: "500m", memory: "512Mi" }
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: hiremind-server-hpa }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: hiremind-server }
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource: { name: cpu, target: { type: Utilization, averageUtilization: 65 } }
```

Required for K8s readiness:

* `GET /api/health` endpoint (added in §38).
* All config via env (already enforced).
* Graceful shutdown on SIGTERM in `index.js`:

```javascript
const server = app.listen(...);
function shutdown(){ server.close(()=>process.exit(0)); setTimeout(()=>process.exit(1), 10_000); }
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
```

* No local disk state for shared data (S3 replaces `/uploads/` in prod).
