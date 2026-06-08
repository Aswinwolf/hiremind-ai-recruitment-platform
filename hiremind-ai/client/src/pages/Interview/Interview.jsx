import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../services/api";
import { Mic, MicOff, SkipForward, Send, CheckCircle2 } from "lucide-react";

export default function Interview() {
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [interviewId, setIid] = useState(null);
  const [answer, setAnswer] = useState("");
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pasteCount, setPaste] = useState(0);
  const [keystrokes, setKeys] = useState(0);
  const recRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => { (async () => {
    try {
      const { data } = await api.post("/api/interview/start");
      setIid(data.interviewId);
      setQuestions(data.questions);
      // jump to first un-answered
      const first = data.questions.findIndex(q => !q.answered);
      if (first >= 0) setIdx(first);
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not start interview");
      nav("/dashboard");
    }
  })(); }, []);

  const startRec = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast.error("Speech recognition needs Chrome or Edge.");
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    rec.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join(" ");
      setAnswer(t);
    };
    rec.onerror = () => setRecording(false);
    rec.start();
    recRef.current = rec; setRecording(true);
  };
  const stopRec = () => { try { recRef.current?.stop(); } catch (_) {} setRecording(false); };

  const submitAnswer = async () => {
    if (!answer.trim()) return toast.error("Please answer or click Skip.");
    setSubmitting(true);
    try {
      await api.post("/api/interview/answer", { interviewId, questionIndex: idx, answer, signal: { pasteCount, keystrokes } });
      const next = questions.findIndex((q, i) => i > idx && !q.answered);
      // mark current as answered locally
      setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, answered: true } : q));
      setAnswer(""); setPaste(0); setKeys(0);
      if (next === -1 || idx >= questions.length - 1) { await complete(); }
      else { setIdx(next === -1 ? idx + 1 : next); }
    } catch (e) { toast.error(e.response?.data?.message || "Failed"); }
    finally { setSubmitting(false); }
  };

  const skip = async () => {
    setSubmitting(true);
    try {
      await api.post("/api/interview/skip", { interviewId, questionIndex: idx, reason: "candidate_skipped" });
      setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, answered: true } : q));
      setAnswer(""); setPaste(0); setKeys(0);
      if (idx >= questions.length - 1) await complete();
      else setIdx(idx + 1);
    } catch (e) { toast.error(e.response?.data?.message || "Failed"); }
    finally { setSubmitting(false); }
  };

  const complete = async () => {
    try {
      const { data } = await api.post("/api/interview/complete", { interviewId });
      sessionStorage.setItem("lastResult", JSON.stringify(data));
      nav("/interview/complete");
    } catch (e) { toast.error("Could not finalise: " + (e.response?.data?.message || e.message)); }
  };

  if (!questions.length) return <div className="p-8 text-slate-500">Preparing your questions…</div>;
  const q = questions[idx];
  const progress = Math.round(((idx) / questions.length) * 100);

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold uppercase tracking-wider text-blue">{q.round} round</div>
        <div className="text-sm text-slate-500">Q {idx + 1} / {questions.length}</div>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded mb-6">
        <div className="h-1.5 bg-blue rounded" style={{ width: `${progress}%` }} />
      </div>

      <div className="card mb-4">
        <h2 className="font-display text-xl font-bold mb-2">{q.question}</h2>
        <p className="text-slate-500 text-sm">Speak your answer naturally. We capture pauses, paste events and typing signals.</p>
      </div>

      <textarea
        data-testid="answer-input"
        className="input min-h-[180px] w-full"
        value={answer}
        onChange={(e) => { setAnswer(e.target.value); setKeys(k => k + 1); }}
        onPaste={() => setPaste(p => p + 1)}
        placeholder="Your answer will appear here as you speak…"
      />

      <div className="flex flex-wrap gap-3 mt-4">
        {!recording ? (
          <button data-testid="rec-start" onClick={startRec} className="btn-ghost"><Mic className="w-4 h-4" /> Start speaking</button>
        ) : (
          <button data-testid="rec-stop" onClick={stopRec} className="btn-ghost border-coral text-coral"><MicOff className="w-4 h-4" /> Stop</button>
        )}
        <button data-testid="answer-submit" onClick={submitAnswer} disabled={submitting} className="btn-primary"><Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit"}</button>
        <button data-testid="answer-skip" onClick={skip} disabled={submitting} className="btn-ghost"><SkipForward className="w-4 h-4" /> Skip</button>
        {idx === questions.length - 1 && (
          <button onClick={complete} className="btn-ghost border-green text-green ml-auto"><CheckCircle2 className="w-4 h-4" /> Finish</button>
        )}
      </div>
    </div>
  );
}
