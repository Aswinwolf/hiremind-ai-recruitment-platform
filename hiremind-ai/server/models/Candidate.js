const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  selectedRole:  { type: String, required: true },
  resumePath:    { type: String },
  parsedResume: {
    name:           String,
    email:          String,
    phone:          String,
    skills:         [String],
    education:      String,
    cgpa:           String,
    college:        String,
    experience:     [String],
    projects:       [String],
    certifications: [String],
    rawText:        String,
  },
  atsScore:      { type: Number, default: 0 },
  missingSkills: [String],
  isEligible:    { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
});

candidateSchema.index({ selectedRole: 1, atsScore: -1 });
candidateSchema.index({ "parsedResume.skills": 1 });

module.exports = mongoose.model("Candidate", candidateSchema);
