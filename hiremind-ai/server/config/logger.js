const winston = require("winston");
const fs = require("fs");

if (!fs.existsSync("logs")) fs.mkdirSync("logs");

const dev = process.env.NODE_ENV !== "production";
const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const fmt = dev
  ? combine(colorize(), timestamp({ format: "HH:mm:ss" }), printf(i => `${i.timestamp} ${i.level} ${i.message}`))
  : combine(timestamp(), errors({ stack: true }), json());

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
