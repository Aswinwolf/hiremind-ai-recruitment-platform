/**
 * Centralised guardrails: scan candidate input + Gemini-bound text.
 * §35 of the implementation guide.
 */

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|above) (instructions|prompts)/i,
  /you are now/i,
  /act as (a |an )?(system|admin|developer)/i,
  /\bsystem\s*:/i,
  /<\s*\/?\s*system\s*>/i,
  /developer\s*mode/i,
  /jailbreak/i,
  /reveal (the )?(system )?prompt/i,
];

const OFFENSIVE = ["fuck", "shit", "bitch", "asshole", "bastard"];

function scanInjection(text = "") {
  return INJECTION_PATTERNS.some(re => re.test(text));
}
function scanOffensive(text = "") {
  return OFFENSIVE.some(w => new RegExp(`\\b${w}\\b`, "i").test(text));
}
function scanTooShort(text = "") {
  const w = text.trim().split(/\s+/).filter(Boolean);
  return text.trim().length < 15 || w.length < 5;
}
function scanAIGenerated(text = "") {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  if (sentences.length < 4) return false;
  const lens = sentences.map(s => s.split(/\s+/).length);
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
  const burstiness = Math.sqrt(variance) / (mean || 1);
  return mean > 18 && burstiness < 0.25;
}
function stripInjection(text = "") {
  let t = text;
  INJECTION_PATTERNS.forEach(re => { t = t.replace(re, ""); });
  return t.trim();
}

function runOutputGuards({ question, answer }) {
  const flags = [];
  if (scanInjection(answer)) flags.push("prompt_injection");
  if (scanOffensive(answer)) flags.push("offensive");
  if (scanTooShort(answer))  flags.push("too_short");
  if (scanAIGenerated(answer)) flags.push("ai_generated");
  if (question && answer && answer.trim().toLowerCase() === question.trim().toLowerCase()) flags.push("memorized");
  return flags;
}

module.exports = {
  scanInjection, scanOffensive, scanTooShort, scanAIGenerated, stripInjection, runOutputGuards,
};
