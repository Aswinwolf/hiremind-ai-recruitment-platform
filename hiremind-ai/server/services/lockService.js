/**
 * Distributed lock for active interview (§30.5) — Redis preferred, in-memory fallback.
 */
const redis = require("../config/redis");

const TTL_SEC = 90;
const KEY = (id) => `iv:lock:${id}`;
const mem = new Map();

async function acquire(interviewId, holder) {
  if (redis) {
    const ok = await redis.set(KEY(interviewId), holder, "NX", "EX", TTL_SEC);
    return ok === "OK";
  }
  const now = Date.now();
  const cur = mem.get(interviewId);
  if (cur && cur.expires > now && cur.holder !== holder) return false;
  mem.set(interviewId, { holder, expires: now + TTL_SEC * 1000 });
  return true;
}

async function renew(interviewId, holder) {
  if (!holder) return false;
  if (redis) {
    const cur = await redis.get(KEY(interviewId));
    if (cur && cur !== holder) return false;
    await redis.set(KEY(interviewId), holder, "EX", TTL_SEC);
    return true;
  }
  const cur = mem.get(interviewId);
  if (cur && cur.holder !== holder && cur.expires > Date.now()) return false;
  mem.set(interviewId, { holder, expires: Date.now() + TTL_SEC * 1000 });
  return true;
}

async function release(interviewId, holder) {
  if (redis) {
    const cur = await redis.get(KEY(interviewId));
    if (cur === holder) await redis.del(KEY(interviewId));
    return;
  }
  const cur = mem.get(interviewId);
  if (cur && cur.holder === holder) mem.delete(interviewId);
}

/** Claim lock for start/resume — overwrites stale holders (e.g. after browser refresh). */
async function claim(interviewId, holder) {
  if (redis) {
    await redis.set(KEY(interviewId), holder, "EX", TTL_SEC);
    return true;
  }
  mem.set(interviewId, { holder, expires: Date.now() + TTL_SEC * 1000 });
  return true;
}

module.exports = { acquire, claim, renew, release };
