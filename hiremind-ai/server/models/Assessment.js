const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  questionId: { type: Number, required: true },
  category: String,
  value: { type: Number, min: 1, max: 5 },
});

const assessmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true, unique: true },
  answers: [answerSchema],
  currentIndex: { type: Number, default: 0 },
  categoryScores: {
    teamwork: Number,
    communication: Number,
    adaptability: Number,
    accountability: Number,
    learningMindset: Number,
    leadershipPotential: Number,
    decisionMaking: Number,
  },
  overallScore: { type: Number, min: 20, max: 100 },
  indicators: {
    confidence: { type: String, enum: ["High", "Moderate", "Low"] },
    teamwork: { type: String, enum: ["High", "Moderate", "Low"] },
    adaptability: { type: String, enum: ["High", "Moderate", "Low"] },
    leadership: { type: String, enum: ["High", "Moderate", "Low"] },
    accountability: { type: String, enum: ["High", "Moderate", "Low"] },
    learningMindset: { type: String, enum: ["High", "Moderate", "Low"] },
    communication: { type: String, enum: ["High", "Moderate", "Low"] },
  },
  status: { type: String, enum: ["in-progress", "completed"], default: "in-progress" },
  completedAt: Date,
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

assessmentSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("Assessment", assessmentSchema);
