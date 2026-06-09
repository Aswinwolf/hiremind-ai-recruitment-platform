const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const path = require("path");
require("dotenv").config();

const connectDB = require("./config/db");
const logger = require("./config/logger");
const sanitize = require("./middleware/sanitize");
const rl = require("./middleware/rateLimiters");

const app = express();

/* ------------------------------ Security ------------------------------ */
app.use(helmet({
  contentSecurityPolicy: false, // dev-friendly; tighten in prod (see §36.2)
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "no-referrer" },
}));

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",");
app.use(cors({
  origin: (origin, cb) => (!origin || allowedOrigins.includes(origin)) ? cb(null, true) : cb(new Error("CORS blocked: " + origin)),
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sanitize);
app.use(rl.global);

/* ------------------------------ Static (dev) ------------------------------ */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ------------------------------ Routes ------------------------------ */
app.use("/api", require("./routes/health"));
app.use("/api/auth", rl.auth, require("./routes/auth"));
app.use("/api/roles", require("./routes/roles"));
app.use("/api/candidate", require("./routes/candidate"));
app.use("/api/interview", rl.interview, require("./routes/interview"));
app.use("/api/behavior-assessment", rl.interview, require("./routes/behaviorAssessment"));
app.use("/api/hr", require("./routes/hr"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/analytics", require("./routes/analytics"));

/* ------------------------------ Errors ------------------------------ */
app.use((err, _req, res, _next) => {
  logger.error(err.message + (err.stack ? "\n" + err.stack : ""));
  if (err.message?.startsWith("CORS blocked")) return res.status(403).json({ message: err.message });
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

/* ------------------------------ Start ------------------------------ */
const PORT = process.env.PORT || 5000;
(async () => {
  await connectDB();
  const server = app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  const shutdown = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
})();

module.exports = app;
