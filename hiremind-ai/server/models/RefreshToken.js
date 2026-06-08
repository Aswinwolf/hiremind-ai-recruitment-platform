const mongoose = require("mongoose");

module.exports = mongoose.model("RefreshToken", new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  tokenHash: { type: String, required: true, unique: true },
  revokedAt: Date,
  expiresAt: { type: Date, required: true, index: true },
  ua: String,
  ip: String,
}));
