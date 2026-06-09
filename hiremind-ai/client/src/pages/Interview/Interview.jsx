import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../services/api";
import { useSpeech } from "../../hooks/useSpeech";
import {
  Mic, MicOff, SkipForward, Send, CheckCircle2, Volume2, VolumeX, RefreshCw, AlertCircle, Radio, Bug,
} from "lucide-react";

const STORAGE_KEY = "hiremind_active_interview";

function micBadge(micStatus, listenState, recording, hasMicStream) {
  if (micStatus === "denied") return { text: "Microphone blocked", color: "bg-coral/10 text-coral border-coral/30", icon: AlertCircle };
  if (micStatus === "unsupported") return { text: "Microphone unavailable", color: "bg-coral/10 text-coral border-coral/30", icon: AlertCircle };
  if (listenState === "listening" || recording) return { text: "Listening — speak now", color: "bg-green/10 text-green border-green/30", icon: Radio };
  if (listenState === "processing") return { text: "Processing speech…", color: "bg-amber/10 text-amber border-amber/30", icon: RefreshCw };
  if (listenState === "error") return { text: "Speech error — try again", color: "bg-coral/10 text-coral border-coral/30", icon: AlertCircle };
  if (hasMicStream || micStatus === "granted") return { text: "Microphone ready — click Start speaking", color: "bg-green/10 text-green border-green/30", icon: Mic };
  if (micStatus === "prompt") return { text: "Click Allow microphone", color: "bg-amber/10 text-amber border-amber/30", icon: Mic };
  return { text: "Microphone not checked", color: "bg-slate-100 text-slate-500 border-slate-200", icon: Mic };
}

export default function Interview() {
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [interviewId, setIid] = useState(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resumed, setResumed] = useState(false);
  const [progress, setProgress] = useState({ answeredCount: 0, totalQuestions: 0, percent: 0 });
  const [pasteCount, setPaste] = useState(0);
  const [keystrokes, setKeys] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [inputMode, setInputMode] = useState("voice");
  const [showDebug, setShowDebug] = useState(true);

  const startCalledRef = useRef(false);
  const questionSpokenRef = useRef(-1);
  const listeningRef = useRef(false);
  const nav = useNavigate();

  const {
    supported, micStatus, recording, speaking, listenState, transcript, interimText, lastError, debugEvents,
    hasMicStream, clearError,
    requestMic, speak, stopSpeaking, startListening, stopListening, resetTranscript, setTranscriptExternal,
  } = useSpeech();

  listeningRef.current = recording || listenState === "listening";

  const persistSession = useCallback((id, data) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ interviewId: id, ...data }));
    } catch (_) { /* ignore */ }
  }, []);

  const advanceToNext = useCallback((currentIdx, qs) => {
    const next = qs.findIndex((q, i) => i > currentIdx && !q.answered);
    if (next >= 0) return next;
    const firstOpen = qs.findIndex((q) => !q.answered);
    return firstOpen >= 0 ? firstOpen : currentIdx + 1;
  }, []);

  const loadInterview = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/api/interview/start");
      setIid(data.interviewId);
      setQuestions(data.questions);
      setResumed(!!data.resumed);
      setProgress(data.progress || { answeredCount: 0, totalQuestions: data.questions.length, percent: 0 });

      const startIdx = data.progress?.currentIndex
        ?? data.questions.findIndex((q) => !q.answered);
      const safeIdx = startIdx >= 0 ? startIdx : 0;
      setIdx(safeIdx);
      setAnswer("");
      resetTranscript();
      questionSpokenRef.current = -1;

      persistSession(data.interviewId, { idx: safeIdx, resumed: data.resumed });

      if (data.resumed) {
        toast.success("Resuming your in-progress interview", { icon: "🔄" });
      }
    } catch (e) {
      const status = e.response?.status;
      const msg = e.response?.data?.message || "Could not start interview";
      toast.error(msg);
      if (status === 409) {
        try {
          const { data } = await api.post("/api/interview/start");
          setIid(data.interviewId);
          setQuestions(data.questions);
          setResumed(true);
          setProgress(data.progress);
          setIdx(data.progress?.currentIndex ?? 0);
          toast.success("Resumed existing interview");
          return;
        } catch (_) { /* fall through */ }
      }
      nav("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [nav, persistSession, resetTranscript]);

  useEffect(() => {
    if (startCalledRef.current) return;
    startCalledRef.current = true;
    loadInterview();
  }, [loadInterview]);

  // Keep answer in sync with voice transcript (final + interim kept separate in hook)
  useEffect(() => {
    const combined = `${transcript}${interimText ? ` ${interimText}` : ""}`.trim();
    if (combined) {
      console.log("[HireMind STT] STEP 5 answer state sync from transcript", combined);
      setAnswer(combined);
      setInputMode("voice");
    }
  }, [transcript, interimText]);

  // TTS — speak question when index changes; never interrupt active listening
  useEffect(() => {
    if (!voiceEnabled || !questions.length || loading) return;
    if (listeningRef.current) return;

    const q = questions[idx];
    if (!q?.question || questionSpokenRef.current === idx) return;

    questionSpokenRef.current = idx;
    stopSpeaking();
    speak(q.question);
  }, [idx, questions, voiceEnabled, loading, speak, stopSpeaking]);

  useEffect(() => {
    if (lastError) toast.error(lastError, { id: "speech-error" });
  }, [lastError]);

  useEffect(() => () => {
    stopListening();
    stopSpeaking();
  }, [stopListening, stopSpeaking]);

  const handleAllowMic = async () => {
    console.log("[HireMind STT] STEP 2 Allow microphone button clicked");
    clearError();
    const ok = await requestMic();
    if (ok) toast.success("Microphone enabled — wait for AI to finish, then click Start speaking");
    else toast.error("Microphone access denied");
  };

  const handleStartSpeaking = async () => {
    console.log("[HireMind STT] STEP 1 Start speaking button clicked", {
      micStatus, hasMicStream, speaking, recording, listenState,
    });
    clearError();
    if (!supported.stt) {
      console.log("[HireMind STT] STEP 1 FAIL SpeechRecognition not supported");
      toast.error("Speech recognition requires Chrome or Edge.");
      setInputMode("text");
      return;
    }

    stopSpeaking();

    console.log("[HireMind STT] STEP 2 requesting mic permission…");
    const micOk = await requestMic();
    if (!micOk) {
      console.log("[HireMind STT] STEP 2 FAIL mic permission not granted");
      return;
    }

    setInputMode("voice");
    const existing = answer.trim();
    if (existing) {
      setTranscriptExternal(existing);
    } else {
      resetTranscript();
    }

    console.log("[HireMind STT] STEP 3 calling startListening()…");
    const started = await startListening(
      (text) => {
        console.log("[HireMind STT] STEP 5 callback → setAnswer", text);
        setAnswer(text);
        setInputMode("voice");
      },
      { reset: !existing },
    );

    console.log("[HireMind STT] STEP 4 startListening returned", { started });
    if (!started) {
      toast.error("Could not start speech recognition. Check the debug panel below.");
    }
  };

  const handleStopSpeaking = () => {
    stopListening();
    const final = (transcript + interimText).trim() || transcript.trim();
    if (final) {
      setAnswer(final);
      setTranscriptExternal(final);
    }
  };

  const submitAnswer = async () => {
    stopListening();
    stopSpeaking();

    const finalAnswer = (answer || `${transcript}${interimText ? ` ${interimText}` : ""}`).trim();
    console.log("[HireMind STT] STEP 6 submit", {
      answer, transcript, interimText, finalAnswer: finalAnswer.slice(0, 80),
    });
    if (!finalAnswer) return toast.error("Please answer or click Skip.");

    setSubmitting(true);
    try {
      const { data } = await api.post("/api/interview/answer", {
        interviewId,
        questionIndex: idx,
        answer: finalAnswer,
        signal: { pasteCount, keystrokes, inputMode },
      });
      const updated = questions.map((q, i) => (i === idx ? { ...q, answered: true } : q));
      setQuestions(updated);
      setProgress(data.progress || progress);
      setAnswer("");
      resetTranscript();
      setPaste(0);
      setKeys(0);
      questionSpokenRef.current = -1;

      const allDone = updated.every((q) => q.answered);
      if (allDone) {
        await finishInterviewRounds();
      } else if (idx >= questions.length - 1) {
        await finishInterviewRounds();
      } else {
        const next = advanceToNext(idx, updated);
        setIdx(next);
        persistSession(interviewId, { idx: next, resumed: true });
      }
    } catch (e) {
      const msg = e.response?.data?.message || "Failed to submit answer";
      toast.error(msg);
      if (e.response?.status === 423) {
        toast("Refreshing session…", { icon: "🔄" });
        await loadInterview();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const skip = async () => {
    stopListening();
    stopSpeaking();
    setSubmitting(true);
    try {
      const { data } = await api.post("/api/interview/skip", {
        interviewId,
        questionIndex: idx,
        reason: "candidate_skipped",
      });
      const updated = questions.map((q, i) => (i === idx ? { ...q, answered: true } : q));
      setQuestions(updated);
      if (data.progress) setProgress(data.progress);
      setAnswer("");
      resetTranscript();
      setPaste(0);
      setKeys(0);
      questionSpokenRef.current = -1;

      const allDone = updated.every((q) => q.answered);
      if (allDone) {
        await finishInterviewRounds();
      } else if (idx >= questions.length - 1) {
        await finishInterviewRounds();
      } else {
        const next = advanceToNext(idx, updated);
        setIdx(next);
        persistSession(interviewId, { idx: next, resumed: true });
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to skip");
      if (e.response?.status === 423) await loadInterview();
    } finally {
      setSubmitting(false);
    }
  };

  const finishInterviewRounds = async () => {
    stopListening();
    stopSpeaking();
    try {
      await api.post("/api/interview/finish-rounds", { interviewId });
      sessionStorage.removeItem(STORAGE_KEY);
      toast.success("Interview complete — workplace assessment next");
      nav("/behavior-assessment");
    } catch (e) {
      toast.error("Could not continue: " + (e.response?.data?.message || e.message));
    }
  };

  const replayQuestion = () => {
    if (recording) return toast.error("Stop recording before replaying the question.");
    stopSpeaking();
    const q = questions[idx];
    if (q?.question) speak(q.question);
  };

  if (loading || !questions.length) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
        Preparing your interview questions…
      </div>
    );
  }

  const q = questions[idx];
  const badge = micBadge(micStatus, listenState, recording, hasMicStream);
  const BadgeIcon = badge.icon;
  const pct = progress.totalQuestions
    ? Math.round((progress.answeredCount / progress.totalQuestions) * 100)
    : Math.round((idx / questions.length) * 100);
  const liveText = `${transcript}${interimText ? ` ${interimText}` : ""}`.trim();
  const displayAnswer = answer || liveText;

  return (
    <div className="max-w-3xl mx-auto p-8">
      {resumed && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-blue/10 text-blue text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Interview resumed — continuing from question {idx + 1}
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold uppercase tracking-wider text-blue">{q.round} round</div>
        <div className="text-sm text-slate-500">Q {idx + 1} / {questions.length}</div>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded mb-2">
        <div className="h-1.5 bg-blue rounded transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-slate-500 mb-4">{progress.answeredCount ?? 0} of {questions.length} answered</div>

      {/* Status bar */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium mb-4 ${badge.color}`}>
        <BadgeIcon className={`w-4 h-4 shrink-0 ${listenState === "processing" ? "animate-spin" : ""}`} />
        <span>{badge.text}</span>
        {speaking && (
          <span className="ml-auto flex items-center gap-1 text-blue text-xs font-normal">
            <Volume2 className="w-3.5 h-3.5" /> AI speaking
          </span>
        )}
        {!supported.stt && (
          <span className="ml-auto text-xs font-normal text-amber">Voice input needs Chrome/Edge</span>
        )}
      </div>

      <div className="card mb-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-bold mb-2 flex-1">{q.question}</h2>
          <div className="flex gap-1 shrink-0">
            <button type="button" onClick={replayQuestion} className="p-2 rounded-lg hover:bg-slate-100" title="Replay question">
              <Volume2 className="w-4 h-4 text-blue" />
            </button>
            <button
              type="button"
              onClick={() => { setVoiceEnabled((v) => !v); if (voiceEnabled) stopSpeaking(); }}
              className="p-2 rounded-lg hover:bg-slate-100"
              title={voiceEnabled ? "Mute AI voice" : "Enable AI voice"}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </div>
        <p className="text-slate-500 text-sm">
          {speaking
            ? "Wait for the AI to finish speaking, then click Start speaking."
            : recording
              ? "Speak your answer — words appear in the live transcript below."
              : "Click Allow microphone, then Start speaking after the question is read aloud."}
        </p>
      </div>

      {/* Live transcript */}
      <div className={`mb-3 rounded-lg border p-4 min-h-[88px] ${recording ? "border-green/40 bg-green/5" : "border-slate-200 bg-slate-50"}`}>
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
          <span>Live transcript</span>
          {recording && (
            <span className="flex items-center gap-1.5 text-green normal-case">
              <span className="w-2 h-2 rounded-full bg-green animate-pulse" /> Recording
            </span>
          )}
        </div>
        {liveText || displayAnswer ? (
          <p className="text-base leading-relaxed text-navy whitespace-pre-wrap">
            <span>{transcript || answer}</span>
            {interimText && <span className="text-slate-400 italic"> {interimText}</span>}
          </p>
        ) : (
          <p className="text-slate-400 text-sm italic">
            {recording ? "Listening… start speaking." : "Your spoken words will appear here."}
          </p>
        )}
      </div>

      <textarea
        data-testid="answer-input"
        className="input min-h-[120px] w-full"
        value={displayAnswer}
        onChange={(e) => {
          setInputMode("text");
          setAnswer(e.target.value);
          setTranscriptExternal(e.target.value);
          setKeys((k) => k + 1);
        }}
        onPaste={() => setPaste((p) => p + 1)}
        placeholder="Type here or use Start speaking — both work."
      />

      <div className="flex flex-wrap gap-3 mt-4">
        {!recording ? (
          <button
            data-testid="rec-start"
            onClick={handleStartSpeaking}
            disabled={submitting || speaking || micStatus === "denied"}
            className="btn-ghost"
          >
            <Mic className="w-4 h-4" /> Start speaking
          </button>
        ) : (
          <button data-testid="rec-stop" onClick={handleStopSpeaking} className="btn-ghost border-coral text-coral">
            <MicOff className="w-4 h-4" /> Stop
          </button>
        )}
        {micStatus !== "granted" && micStatus !== "denied" && (
          <button type="button" onClick={handleAllowMic} className="btn-ghost text-sm border-amber text-amber">
            <Mic className="w-4 h-4" /> Allow microphone
          </button>
        )}
        <button
          data-testid="answer-submit"
          onClick={submitAnswer}
          disabled={submitting || !displayAnswer.trim()}
          className="btn-primary"
        >
          <Send className="w-4 h-4" /> {submitting ? "Submitting…" : "Submit"}
        </button>
        <button data-testid="answer-skip" onClick={skip} disabled={submitting} className="btn-ghost">
          <SkipForward className="w-4 h-4" /> Skip
        </button>
        {idx === questions.length - 1 && (
          <button onClick={finishInterviewRounds} disabled={submitting} className="btn-ghost border-green text-green ml-auto">
            <CheckCircle2 className="w-4 h-4" /> Continue to Assessment
          </button>
        )}
      </div>

      {/* Debug panel */}
      <div className="mt-8 border border-slate-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDebug((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-2 bg-slate-100 text-sm font-medium text-slate-600 hover:bg-slate-200"
        >
          <Bug className="w-4 h-4" />
          Speech debug {showDebug ? "▾" : "▸"}
        </button>
        {showDebug && (
          <div className="p-4 bg-slate-50 text-xs font-mono space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-white border rounded p-2">
                <div className="text-slate-500">Mic permission</div>
                <div className="font-semibold text-navy">{micStatus}</div>
              </div>
              <div className="bg-white border rounded p-2">
                <div className="text-slate-500">Media stream</div>
                <div className="font-semibold text-navy">{hasMicStream ? "active" : "none"}</div>
              </div>
              <div className="bg-white border rounded p-2">
                <div className="text-slate-500">Listen state</div>
                <div className="font-semibold text-navy">{listenState}</div>
              </div>
              <div className="bg-white border rounded p-2">
                <div className="text-slate-500">STT supported</div>
                <div className="font-semibold text-navy">{supported.stt ? "yes" : "no"}</div>
              </div>
            </div>
            <div className="bg-white border rounded p-2">
              <div className="text-slate-500 mb-1">Live transcript</div>
              <div className="text-navy break-words">{liveText || "(empty)"}</div>
            </div>
            <div className="bg-white border rounded p-2 max-h-40 overflow-y-auto">
              <div className="text-slate-500 mb-1">Event log (also in browser console)</div>
              {debugEvents.length === 0 ? (
                <div className="text-slate-400">No events yet</div>
              ) : (
                debugEvents.map((e, i) => (
                  <div key={i} className="text-slate-700 leading-5">
                    <span className="text-slate-400">{e.t}</span> {e.msg}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
