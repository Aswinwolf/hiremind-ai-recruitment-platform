/**
 * Behavioural weights map (§33.6)
 */
const POS = {
  teamwork:           { Strong: 1, Adequate: 0.6, Weak: 0.2 },
  leadership:         { Demonstrated: 1, Emerging: 0.6, "Not Shown": 0.2 },
  adaptability:       { High: 1, Medium: 0.6, Low: 0.2 },
  accountability:     { High: 1, Medium: 0.6, Low: 0.2 },
  conflictResolution: { Mature: 1, Reactive: 0.5, Avoidant: 0.2 },
  learningMindset:    { Growth: 1, Mixed: 0.6, Fixed: 0.3 },
  decisionMaking:     { "Data-driven": 1, Intuitive: 0.6, Hesitant: 0.3 },
};
function score(b) {
  if (!b) return 0;
  const keys = Object.keys(POS);
  const sum = keys.reduce((s, k) => s + (POS[k][b[k]] ?? 0.5), 0);
  return Math.round((sum / keys.length) * 100);
}
module.exports = { score, POS };
