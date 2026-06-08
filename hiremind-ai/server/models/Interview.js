const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  question: String,
  answer:   String,
  round:    { type: String, enum: ["technical", "resume", "behavioral"] },
  scores: {
    technical:          { type: Number, default: 0 },
    communication:      { type: Number, default: 0 },
    problemSolving:     { type: Number, default: 0 },
    confidence:         { type: Number, default: 0 },
    clarity:            { type: Number, default: 0 },
    practicalKnowledge: { type: Number, default: 0 },
    redFlags:           { type: [String], default: [] },
    _skipped:           { type: Boolean, default: false },
  },
  meta:      { type: Object, default: {} },
  timestamp: { type: Date, default: Date.now },
});

const interviewSchema = new mongoose.Schema({
  candidateId:  { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true },
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  selectedRole: String,
  questions:    [questionSchema],
  status:       { type: String, enum: ["in-progress", "completed", "abandoned"], default: "in-progress" },

  progress: {
    currentIndex:    { type: Number, default: 0 },
    answeredCount:   { type: Number, default: 0 },
    totalQuestions:  { type: Number, default: 0 },
    currentRound:    { type: String, default: "technical" },
    roundsCompleted: { type: [String], default: [] },
    lastActivityAt:  { type: Date, default: Date.now },
  },
  session: {
    sessionToken:  { type: String, index: true },
    ipHash:        String,
    userAgentHash: String,
    startedAt:     { type: Date, default: Date.now },
    resumeCount:   { type: Number, default: 0 },
    isLocked:      { type: Boolean, default: false },
  },

  psychIndicators: {
    confidence: String,
    clarity: String,
    collaboration: String,
    problemSolving: String,
    learningAttitude: String,
    summary: String,
    behavioral: {
      teamwork: String,
      leadership: String,
      adaptability: String,
      accountability: String,
      conflictResolution: String,
      learningMindset: String,
      decisionMaking: String,
      evidence: Object,
      overallBehaviorScore: { type: Number, default: 0 },
    },
  },

  finalScores: {
    atsScore:        Number,
    technicalScore:  Number,
    behavioralScore: Number,
    commScore:       Number,
    finalScore:      Number,
  },
  recommendation: { type: String, enum: ["Highly Recommended", "Recommended", "Needs Improvement"] },
  decisionBrief: {
    strengths:             [String],
    weaknesses:            [String],
    missingSkills:         [String],
    riskFactors:           [{ code: String, detail: String }],
    hiringConfidenceScore: { type: Number, default: 0 },
    interviewSummary:      String,
    generatedAt:           Date,
  },
  flags:       { type: [String], default: [] },
  reportPath:  String,
  completedAt: Date,
  createdAt:   { type: Date, default: Date.now },
});

// Prevent duplicate active interviews
interviewSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "in-progress" } }
);
interviewSchema.index({ selectedRole: 1, "finalScores.finalScore": -1 });

module.exports = mongoose.model("Interview", interviewSchema);
