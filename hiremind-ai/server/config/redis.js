let client = null;
if (process.env.REDIS_URL) {
  try {
    const IORedis = require("ioredis");
    client = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    client.on("error", (e) => console.warn("Redis error:", e.message));
    console.log("Redis: configured");
  } catch (e) {
    console.warn("Redis init failed:", e.message);
  }
} else {
  // no Redis in dev — fall back to in-memory shims in lockService / antiRepeat
}
module.exports = client;
