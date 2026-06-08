/**
 * Seed default roles. Idempotent (upsert).
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Role = require("../models/Role");

const DEFAULT_ROLES = [
  { title: "MERN Developer",    requiredSkills: ["React", "Node.js", "MongoDB", "Express", "Git", "Docker"] },
  { title: "Python Developer",  requiredSkills: ["Python", "Django", "REST API", "SQL", "Git", "Docker"] },
  { title: "Data Analyst",      requiredSkills: ["Python", "Pandas", "SQL", "Tableau", "Excel", "NumPy"] },
  { title: "DevOps Engineer",   requiredSkills: ["Docker", "Kubernetes", "CI/CD", "Linux", "AWS", "Terraform"] },
  { title: "AI Engineer",       requiredSkills: ["Python", "LangChain", "LLM", "PyTorch", "FastAPI", "NLP"] },
];

(async () => {
  if (!process.env.MONGODB_URI) { console.error("MONGODB_URI missing"); process.exit(1); }
  await mongoose.connect(process.env.MONGODB_URI);
  for (const r of DEFAULT_ROLES) {
    await Role.updateOne({ title: r.title }, { $setOnInsert: r }, { upsert: true });
  }
  console.log(`Seeded ${DEFAULT_ROLES.length} roles.`);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
