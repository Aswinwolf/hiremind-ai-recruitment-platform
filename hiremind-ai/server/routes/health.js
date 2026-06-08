const router = require("express").Router();
router.get("/health", (_req, res) => res.json({ ok: true, uptime: process.uptime(), service: "hiremind-server" }));
module.exports = router;
