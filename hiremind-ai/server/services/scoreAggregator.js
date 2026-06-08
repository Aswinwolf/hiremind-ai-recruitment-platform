/**
 * Score aggregation (§32.5)
 */
const W = { technical: 0.30, problemSolving: 0.20, communication: 0.15, clarity: 0.10, practicalKnowledge: 0.15, confidence: 0.10 };

function answerScore(s) {
  if (!s || s._skipped) return 0;
  return (
    s.technical * W.technical +
    s.problemSolving * W.problemSolving +
    s.communication * W.communication +
    s.clarity * W.clarity +
    s.practicalKnowledge * W.practicalKnowledge +
    s.confidence * W.confidence
  ) * 10;
}

function roundAverages(questions = []) {
  const by = { technical: [], resume: [], behavioral: [] };
  for (const q of questions) {
    if (q.scores && !q.scores._skipped && by[q.round]) by[q.round].push(answerScore(q.scores));
  }
  const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  return { technical: avg(by.technical), resume: avg(by.resume), behavioral: avg(by.behavioral) };
}

function dimAvg(questions, key) {
  const v = (questions || []).map(q => q.scores?.[key]).filter(x => typeof x === "number" && !isNaN(x));
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) : 0;
}

module.exports = { answerScore, roundAverages, dimAvg, W };
