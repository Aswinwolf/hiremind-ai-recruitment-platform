const xss = require("xss");
const mongoSanitize = require("express-mongo-sanitize");

function deepSanitize(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === "string") obj[k] = xss(v, { whiteList: {}, stripIgnoreTag: true });
    else if (typeof v === "object") deepSanitize(v);
  }
}

module.exports = [
  mongoSanitize({ replaceWith: "_" }),
  (req, _res, next) => {
    deepSanitize(req.body);
    deepSanitize(req.query);
    next();
  },
];
