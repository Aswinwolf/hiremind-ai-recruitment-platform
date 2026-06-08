const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema({
  title:          { type: String, required: true, unique: true },
  requiredSkills: [String],
  atsThreshold:   { type: Number, default: 60 },
  description:    String,
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt:      { type: Date, default: Date.now },
});

module.exports = mongoose.model("Role", roleSchema);
