const Role = require("../models/Role");

/**
 * ATS Score Engine
 * Compares candidate skills vs role required skills.
 */
async function calculateATS(candidateSkills, roleTitle) {
  const role = await Role.findOne({ title: roleTitle });
  if (!role) throw new Error("Role not found");

  const required = role.requiredSkills.map(s => s.toLowerCase());
  const candidate = (candidateSkills || []).map(s => s.toLowerCase());

  const matched = required.filter(r =>
    candidate.some(c => c.includes(r) || r.includes(c))
  );

  const score = required.length ? Math.round((matched.length / required.length) * 100) : 0;

  const missing = role.requiredSkills.filter(r =>
    !candidate.some(c => c.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(c.toLowerCase()))
  );

  return {
    atsScore: score,
    missingSkills: missing,
    matchedSkills: matched.length,
    totalRequired: required.length,
    threshold: role.atsThreshold,
  };
}

module.exports = { calculateATS };
