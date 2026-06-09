const crypto = require("crypto");

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

function hashRequestMeta(req) {
  return {
    ipHash: sha(req.ip || req.connection?.remoteAddress || "unknown"),
    userAgentHash: sha(req.get("user-agent") || "unknown"),
  };
}

function isAnswered(q) {
  return !!(q.answer && String(q.answer).trim());
}

function formatQuestions(interview) {
  return interview.questions.map((q, i) => ({
    index: i,
    question: q.question,
    round: q.round,
    answered: isAnswered(q),
  }));
}

function firstUnansweredIndex(interview) {
  const i = interview.questions.findIndex((q) => !isAnswered(q));
  return i >= 0 ? i : Math.max(0, interview.questions.length - 1);
}

function buildStartPayload(interview, { resumed }) {
  const idx = interview.progress?.currentIndex ?? firstUnansweredIndex(interview);
  const answeredCount = interview.questions.filter(isAnswered).length;
  return {
    interviewId: interview._id,
    resumed,
    questions: formatQuestions(interview),
    progress: {
      currentIndex: idx,
      answeredCount,
      totalQuestions: interview.questions.length,
      currentRound: interview.progress?.currentRound || "technical",
      roundsCompleted: interview.progress?.roundsCompleted || [],
      percent: interview.questions.length
        ? Math.round((answeredCount / interview.questions.length) * 100)
        : 0,
    },
  };
}

async function touchResumeSession(interview, req) {
  const meta = hashRequestMeta(req);
  interview.session = interview.session || {};
  interview.session.sessionToken = crypto.randomUUID();
  interview.session.ipHash = meta.ipHash;
  interview.session.userAgentHash = meta.userAgentHash;
  interview.session.resumeCount = (interview.session.resumeCount || 0) + 1;
  if (!interview.session.startedAt) interview.session.startedAt = new Date();
  interview.session.isLocked = true;
  interview.progress = interview.progress || {};
  interview.progress.currentIndex = firstUnansweredIndex(interview);
  interview.progress.answeredCount = interview.questions.filter(isAnswered).length;
  interview.progress.totalQuestions = interview.questions.length;
  interview.progress.lastActivityAt = new Date();
  await interview.save();
  return interview;
}

async function initNewSession(interview, req) {
  const meta = hashRequestMeta(req);
  interview.session = {
    sessionToken: crypto.randomUUID(),
    ipHash: meta.ipHash,
    userAgentHash: meta.userAgentHash,
    startedAt: new Date(),
    resumeCount: 0,
    isLocked: true,
  };
  interview.progress = interview.progress || {};
  interview.progress.currentIndex = 0;
  interview.progress.answeredCount = 0;
  interview.progress.totalQuestions = interview.questions.length;
  interview.progress.lastActivityAt = new Date();
  await interview.save();
  return interview;
}

module.exports = {
  buildStartPayload,
  touchResumeSession,
  initNewSession,
  firstUnansweredIndex,
  isAnswered,
  formatQuestions,
};
