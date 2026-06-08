/**
 * Create production indexes (§39.1). Idempotent.
 */
require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  if (!process.env.MONGODB_URI) { console.error("MONGODB_URI missing"); process.exit(1); }
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  await db.collection("users").createIndexes([
    { key: { email: 1 }, unique: true, name: "uniq_email" },
    { key: { role: 1, createdAt: -1 }, name: "role_createdAt" },
  ]);

  await db.collection("candidates").createIndexes([
    { key: { userId: 1 }, unique: true, name: "uniq_userId" },
    { key: { selectedRole: 1, atsScore: -1 }, name: "role_atsScore" },
    { key: { isEligible: 1, selectedRole: 1 }, name: "eligible_role" },
    { key: { "parsedResume.skills": 1 }, name: "skills_multikey" },
  ]);

  await db.collection("interviews").createIndexes([
    { key: { userId: 1, status: 1 }, name: "user_status",
      unique: true, partialFilterExpression: { status: "in-progress" } },
    { key: { candidateId: 1, completedAt: -1 }, name: "candidate_completedAt" },
    { key: { selectedRole: 1, "finalScores.finalScore": -1 }, name: "role_finalScore" },
    { key: { status: 1, "progress.lastActivityAt": 1 }, name: "stale_sweeper" },
    { key: { recommendation: 1, completedAt: -1 }, name: "rec_completedAt" },
  ]);

  await db.collection("auditlogs").createIndexes([
    { key: { userId: 1, at: -1 }, name: "user_at" },
    { key: { action: 1, at: -1 }, name: "action_at" },
    { key: { at: 1 }, name: "ttl_at", expireAfterSeconds: 60 * 60 * 24 * 180 },
  ]);

  await db.collection("refreshtokens").createIndexes([
    { key: { tokenHash: 1 }, unique: true, name: "uniq_tokenHash" },
    { key: { userId: 1, expiresAt: -1 }, name: "user_expires" },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "ttl_expires" },
  ]);

  console.log("All indexes created.");
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
