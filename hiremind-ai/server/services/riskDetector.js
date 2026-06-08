/**
 * Risk detector (§34.4)
 */
function detectRisks(interview) {
  const risks = [];
  const qs = interview.questions || [];
  const skipped = qs.filter(q => q.scores?._skipped).length;
  if (skipped > 2) risks.push({ code: "EXCESSIVE_SKIPS", detail: `Skipped ${skipped} of ${qs.length} questions` });

  const flagged = qs.flatMap(q => q.scores?.redFlags || []);
  if (flagged.includes("prompt_injection")) risks.push({ code: "PROMPT_INJECTION", detail: "Attempted to override system prompt" });
  if (flagged.filter(f => f === "paste_detected").length > 1) risks.push({ code: "COPY_PASTE_PATTERN", detail: "Multiple answers show paste pattern" });
  if (flagged.filter(f => f === "too_short").length >= 3) risks.push({ code: "TOO_SHORT_PATTERN", detail: "Multiple trivially short answers" });
  if (flagged.includes("offensive")) risks.push({ code: "OFFENSIVE_CONTENT", detail: "Answer contained offensive language" });
  if (flagged.includes("ai_generated")) risks.push({ code: "AI_ASSISTED_ANSWERS", detail: "High likelihood of AI-written answers" });
  if (flagged.includes("memorized")) risks.push({ code: "MEMORIZED_ANSWERS", detail: "Answer copied the question back" });

  return { risks, skipped };
}
module.exports = { detectRisks };
