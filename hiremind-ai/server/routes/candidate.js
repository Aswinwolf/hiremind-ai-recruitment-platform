const router = require("express").Router();
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const Candidate = require("../models/Candidate");
const Interview = require("../models/Interview");
const Assessment = require("../models/Assessment");
const Role = require("../models/Role");
const { calculateATS } = require("../services/atsService");
const { generateReport } = require("../services/reportService");

router.get("/me", auth, async (req, res) => {
  const c = await Candidate.findOne({ userId: req.user.id });
  res.json(c || null);
});

router.post("/select-role", auth, async (req, res) => {
  try {
    const { selectedRole } = req.body;
    if (!selectedRole) return res.status(400).json({ message: "selectedRole is required" });
    const role = await Role.findOne({ title: selectedRole });
    if (!role) return res.status(404).json({ message: "Role does not exist" });

    let candidate = await Candidate.findOne({ userId: req.user.id });
    if (!candidate) candidate = new Candidate({ userId: req.user.id, selectedRole });
    else candidate.selectedRole = selectedRole;
    await candidate.save();
    res.json({ message: "Role saved", candidate });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/upload-resume", auth, upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Resume file is required" });
    await upload.verifyPdfMagic(req.file.path);

    // Call parser microservice
    const filePath = path.resolve(req.file.path);
    let parsedResume = {};
    try {
      const { data } = await axios.post(`${process.env.PARSER_URL}/parse`, { filePath }, { timeout: 30000 });
      parsedResume = data || {};
    } catch (e) {
      return res.status(502).json({ message: "Parser unreachable: " + e.message });
    }

    let candidate = await Candidate.findOne({ userId: req.user.id });
    if (!candidate) return res.status(400).json({ message: "Please select a role first" });
    candidate.resumePath = filePath;
    candidate.parsedResume = parsedResume;
    await candidate.save();
    res.json({ message: "Resume uploaded and parsed", parsedResume });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/calculate-ats", auth, async (req, res) => {
  try {
    const candidate = await Candidate.findOne({ userId: req.user.id });
    if (!candidate?.parsedResume?.skills?.length)
      return res.status(400).json({ message: "Resume not parsed yet" });
    const { atsScore, missingSkills, threshold } = await calculateATS(
      candidate.parsedResume.skills, candidate.selectedRole
    );
    candidate.atsScore = atsScore;
    candidate.missingSkills = missingSkills;
    candidate.isEligible = atsScore >= threshold;
    await candidate.save();
    res.json({ atsScore, missingSkills, isEligible: candidate.isEligible, threshold });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/report", auth, async (req, res) => {
  try {
    const candidate = await Candidate.findOne({ userId: req.user.id });
    const interview = await Interview.findOne({ userId: req.user.id, status: "completed" }).sort({ completedAt: -1 });
    if (!interview) return res.status(404).json({ message: "No completed interview found" });
    const assessment = await Assessment.findOne({ interviewId: interview._id, status: "completed" });
    const filePath = await generateReport(candidate, interview, assessment);
    interview.reportPath = filePath; await interview.save();
    res.download(filePath, "HireMind_Report.pdf");
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
