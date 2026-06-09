import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../services/api";
import { ChevronLeft, ChevronRight, ClipboardList, CheckCircle2 } from "lucide-react";

const LIKERT = [
  { value: 1, label: "Strongly Disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly Agree" },
];

const STORAGE_KEY = "hiremind_assessment_session";

export default function BehaviorAssessment() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [idx, setIdx] = useState(0);
  const [interviewId, setInterviewId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const saveTimer = useRef(null);
  const nav = useNavigate();

  const answerList = () =>
    Object.entries(answers).map(([questionId, value]) => ({
      questionId: Number(questionId),
      value: Number(value),
    }));

  const persistLocal = useCallback((id, ans, currentIdx) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ interviewId: id, answers: ans, idx: currentIdx }));
    } catch (_) { /* ignore */ }
  }, []);

  const saveProgress = useCallback(async (id, ans, currentIdx) => {
    if (!id) return;
    try {
      await api.patch("/api/behavior-assessment/progress", {
        interviewId: id,
        answers: Object.entries(ans).map(([questionId, value]) => ({ questionId: Number(questionId), value })),
        currentIndex: currentIdx,
      });
    } catch (_) { /* silent auto-save */ }
  }, []);

  const scheduleSave = useCallback((id, ans, currentIdx) => {
    persistLocal(id, ans, currentIdx);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveProgress(id, ans, currentIdx), 400);
  }, [persistLocal, saveProgress]);

  useEffect(() => {
    (async () => {
      try {
        const statusRes = await api.get("/api/behavior-assessment/status");
        const { status, interviewId: ivId } = statusRes.data;

        if (status === "completed") {
          nav("/interview/complete");
          return;
        }

        let data;
        if (status === "in-progress" && ivId) {
          const res = await api.get(`/api/behavior-assessment/resume/${ivId}`);
          data = res.data;
        } else if (status === "not-started" && ivId) {
          const res = await api.post("/api/behavior-assessment/start", { interviewId: ivId });
          data = res.data;
        } else {
          const cached = sessionStorage.getItem(STORAGE_KEY);
          if (cached) {
            const c = JSON.parse(cached);
            const res = await api.get(`/api/behavior-assessment/resume/${c.interviewId}`).catch(() =>
              api.post("/api/behavior-assessment/start", { interviewId: c.interviewId })
            );
            data = res.data;
          } else {
            toast.error("Complete your interview rounds first.");
            nav("/dashboard");
            return;
          }
        }

        setInterviewId(data.interviewId);
        setQuestions(data.questions || []);

        const ansMap = {};
        (data.answers || []).forEach((a) => { if (a.value) ansMap[a.questionId] = a.value; });
        setAnswers(ansMap);
        setIdx(data.currentIndex || 0);
      } catch (e) {
        toast.error(e.response?.data?.message || "Could not load assessment");
        nav("/dashboard");
      } finally {
        setLoading(false);
      }
    })();
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [nav]);

  const setAnswer = (questionId, value) => {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    scheduleSave(interviewId, next, idx);
  };

  const goNext = () => {
    const q = questions[idx];
    if (!answers[q?.id]) return toast.error("Please select a response before continuing.");
    if (idx < questions.length - 1) {
      const next = idx + 1;
      setIdx(next);
      scheduleSave(interviewId, answers, next);
    }
  };

  const goPrev = () => {
    if (idx > 0) {
      const next = idx - 1;
      setIdx(next);
      scheduleSave(interviewId, answers, next);
    }
  };

  const submit = async () => {
    const q = questions[idx];
    if (!answers[q?.id]) return toast.error("Please select a response.");
    const missing = questions.filter((qu) => !answers[qu.id]);
    if (missing.length) return toast.error(`Please answer all questions (${missing.length} remaining).`);

    setSubmitting(true);
    try {
      const { data } = await api.post("/api/behavior-assessment/submit", {
        interviewId,
        answers: answerList(),
      });
      sessionStorage.setItem("lastResult", JSON.stringify(data));
      sessionStorage.removeItem(STORAGE_KEY);
      toast.success("Assessment complete!");
      nav("/interview/complete");
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not submit assessment");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !questions.length) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-slate-500">
        Loading workplace readiness assessment…
      </div>
    );
  }

  const q = questions[idx];
  const pct = Math.round(((idx + 1) / questions.length) * 100);
  const answeredCount = questions.filter((qu) => answers[qu.id]).length;
  const isLast = idx === questions.length - 1;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="w-8 h-8 text-blue shrink-0" />
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Workplace Readiness Assessment</h1>
          <p className="text-slate-500 text-sm">Behavioral intelligence self-assessment — not a clinical evaluation.</p>
        </div>
      </div>

      <div className="mb-2 flex justify-between text-sm text-slate-500">
        <span>Question {idx + 1} of {questions.length}</span>
        <span>{answeredCount}/{questions.length} answered</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full mb-6">
        <div className="h-2 bg-blue rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="card mb-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-blue mb-2">{q.categoryLabel}</div>
        <p className="font-display text-lg sm:text-xl font-semibold text-navy leading-snug">{q.text}</p>
      </div>

      <div className="space-y-2 mb-8">
        {LIKERT.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg border cursor-pointer transition ${
              answers[q.id] === opt.value
                ? "border-blue bg-blue/5 ring-1 ring-blue"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name={`q-${q.id}`}
              value={opt.value}
              checked={answers[q.id] === opt.value}
              onChange={() => setAnswer(q.id, opt.value)}
              className="w-4 h-4 accent-blue"
            />
            <span className="text-sm font-medium text-navy">{opt.value}. {opt.label}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 justify-between">
        <button
          type="button"
          onClick={goPrev}
          disabled={idx === 0}
          className="btn-ghost disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        {!isLast ? (
          <button type="button" onClick={goNext} className="btn-primary">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={submitting} className="btn-primary">
            <CheckCircle2 className="w-4 h-4" /> {submitting ? "Submitting…" : "Submit & View Report"}
          </button>
        )}
      </div>
    </div>
  );
}
