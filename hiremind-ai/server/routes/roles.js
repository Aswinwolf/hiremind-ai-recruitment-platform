const router = require("express").Router();
const Role = require("../models/Role");
const auth = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");

const DEFAULT_ROLES = [
  { title: "MERN Developer",    requiredSkills: ["React", "Node.js", "MongoDB", "Express", "Git", "Docker"] },
  { title: "Python Developer",  requiredSkills: ["Python", "Django", "REST API", "SQL", "Git", "Docker"] },
  { title: "Data Analyst",      requiredSkills: ["Python", "Pandas", "SQL", "Tableau", "Excel", "NumPy"] },
  { title: "DevOps Engineer",   requiredSkills: ["Docker", "Kubernetes", "CI/CD", "Linux", "AWS", "Terraform"] },
  { title: "AI Engineer",       requiredSkills: ["Python", "LangChain", "LLM", "PyTorch", "FastAPI", "NLP"] },
];

router.post("/seed", auth, requireRole("admin"), async (_req, res) => {
  for (const r of DEFAULT_ROLES) {
    await Role.updateOne({ title: r.title }, { $setOnInsert: r }, { upsert: true });
  }
  res.json({ message: "Roles seeded", count: DEFAULT_ROLES.length });
});

router.get("/", auth, async (_req, res) => {
  const roles = await Role.find({}).sort({ title: 1 });
  res.json(roles);
});

router.put("/:id", auth, requireRole("admin"), async (req, res) => {
  const role = await Role.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(role);
});

module.exports = router;
