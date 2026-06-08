const rateLimit = require("express-rate-limit");

const tooMany = (msg) => ({ status: 429, message: msg });

exports.global = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany("Too many requests. Try again in a minute."),
});

exports.auth = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  message: tooMany("Too many login attempts. Try again in 15 minutes."),
  skipSuccessfulRequests: true,
});

exports.upload = rateLimit({
  windowMs: 60 * 60_000,
  max: 20,
  message: tooMany("Upload limit reached for this hour."),
});

exports.interview = rateLimit({
  windowMs: 60_000,
  max: 60,
  message: tooMany("Slow down — too many interview requests in a short time."),
});
