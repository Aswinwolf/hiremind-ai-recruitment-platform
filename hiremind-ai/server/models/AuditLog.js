const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  action:    { type: String, required: true, index: true },
  resource:  { type: String, default: null },
  ip:        String,
  userAgent: String,
  payload:   mongoose.Schema.Types.Mixed,
  at:        { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model("AuditLog", auditLogSchema);
