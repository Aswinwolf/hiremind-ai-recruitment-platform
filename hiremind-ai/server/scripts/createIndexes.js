/**
 * Create production indexes (§39.1). Idempotent — tolerates pre-existing indexes.
 */
require("dotenv").config();
const mongoose = require("mongoose");

async function safeCreate(coll, specs) {
  for (const s of specs) {
    try {
      await coll.createIndex(s.key, { ...s, key: undefined });
    } catch (e) {
      if (e.codeName === "IndexOptionsConflict" || e.codeName === "IndexKeySpecsConflict") {
        console.warn(`  skip ${s.name || JSON.stringify(s.key)} — already exists with different options`);
      } else {
        throw e;
      }
    }
  }
}

(async () => {
  if (!process.env.MONGODB_URI) { console.error("MONGODB_URI missing"); process.exit(1); }
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  await safeCreate(db.collection("users"), [
    { key: { email: 1 }, unique: true, name: "uniq_email" },
    { key: { role: 1, createdAt: -1 }, name: "role_createdAt" },
  ]);

  await safeCreate(db.collection("candidates"), [
    { key: { userId: 1 }, unique: true, name: "uniq_userId" },
    { key: { selectedRole: 1, atsScore: -1 }, name: "role_atsScore" },
    { key: { isEligible: 1, selectedRole: 1 }, name: "eligible_role" },
    { key: { "parsedResume.skills": 1 }, name: "skills_multikey" },
  ]);

  await safeCreate(db.collection("interviews"), [
    { key: { userId: 1, status: 1 }, name: "user_status",
      unique: true, partialFilterExpression: { status: "in-progress" } },
    { key: { candidateId: 1, completedAt: -1 }, name: "candidate_completedAt" },
    { key: { selectedRole: 1, "finalScores.finalScore": -1 }, name: "role_finalScore" },
    { key: { status: 1, "progress.lastActivityAt": 1 }, name: "stale_sweeper" },
    { key: { recommendation: 1, completedAt: -1 }, name: "rec_completedAt" },
  ]);

  await safeCreate(db.collection("auditlogs"), [
    { key: { userId: 1, at: -1 }, name: "user_at" },
    { key: { action: 1, at: -1 }, name: "action_at" },
    { key: { at: 1 }, name: "ttl_at", expireAfterSeconds: 60 * 60 * 24 * 180 },
  ]);

  await safeCreate(db.collection("assessments"), [
    { key: { userId: 1, status: 1 }, name: "user_status" },
    { key: { interviewId: 1 }, unique: true, name: "uniq_interviewId" },
    { key: { completedAt: -1 }, name: "completedAt" },
  ]);

  await safeCreate(db.collection("refreshtokens"), [
    { key: { tokenHash: 1 }, unique: true, name: "uniq_tokenHash" },
    { key: { userId: 1, expiresAt: -1 }, name: "user_expires" },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "ttl_expires" },
  ]);

  console.log("All indexes created (or skipped if conflicting).");
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
