import { useCallback, useEffect, useRef, useState } from "react";

const SR_Ctor = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

const LOG = "[HireMind STT]";

const ERROR_MESSAGES = {
  "not-allowed": "Microphone permission denied. Click Allow microphone and try again.",
  "no-speech": "No speech detected — still listening. Speak clearly into your mic.",
  network: "Speech recognition needs internet (Chrome sends audio to Google).",
  aborted: "Speech recognition stopped.",
  "audio-capture": "No microphone found. Connect a mic and try again.",
  "service-not-allowed": "Speech recognition blocked. Use Chrome or Edge on localhost/HTTPS.",
};

function ts() {
  return new Date().toLocaleTimeString();
}

/**
 * Web Speech API — SpeechRecognition (STT) + SpeechSynthesis (TTS).
 * Keeps a live MediaStream open while listening (required on many Windows setups).
 */
export function useSpeech() {
  const [supported, setSupported] = useState({ stt: false, tts: false });
  const [micStatus, setMicStatus] = useState("unknown");
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [listenState, setListenState] = useState("idle");
  const [micStreamActive, setMicStreamActive] = useState(false);
  const [debugEvents, setDebugEvents] = useState([]);

  const recRef = useRef(null);
  const wantRecordingRef = useRef(false);
  const finalBufferRef = useRef("");
  const onTranscriptRef = useRef(null);
  const restartTimerRef = useRef(null);
  const buildRecognitionRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const ttsActiveRef = useRef(false);
  const voicesRef = useRef([]);

  const pushDebug = useCallback((msg, data) => {
    const line = data !== undefined ? `${msg} ${JSON.stringify(data)}` : msg;
    console.log(LOG, line);
    setDebugEvents((prev) => [...prev.slice(-19), { t: ts(), msg: line }]);
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const releaseMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      setMicStreamActive(false);
      pushDebug("media stream released");
    }
  }, [pushDebug]);

  const emitTranscript = useCallback((finalPart, interimPart) => {
    const display = `${finalPart}${interimPart}`.trim();
    console.log(LOG, "STEP 5 transcript state update", { finalPart, interimPart, display });
    setTranscript(finalPart);
    setInterimText(interimPart);
    if (display) pushDebug("STEP 5 transcript captured", { final: finalPart, interim: interimPart, display });
    onTranscriptRef.current?.(display, { interim: interimPart, final: finalPart });
  }, [pushDebug]);

  const destroyRecognition = useCallback((reason = "unknown") => {
    clearRestartTimer();
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    pushDebug("recognition destroy", { reason });
    try {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onstart = null;
      rec.onspeechstart = null;
      rec.onspeechend = null;
      rec.stop();
    } catch (_) { /* ignore */ }
  }, [clearRestartTimer, pushDebug]);

  useEffect(() => {
    const stt = !!SR_Ctor;
    const tts = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported({ stt, tts });
    pushDebug("init", {
      stt,
      tts,
      ctor: SR_Ctor ? (window.SpeechRecognition ? "SpeechRecognition" : "webkitSpeechRecognition") : "none",
    });

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "microphone" })
        .then((p) => {
          pushDebug("mic permission status", { state: p.state });
          setMicStatus(p.state);
          p.onchange = () => {
            pushDebug("mic permission changed", { state: p.state });
            setMicStatus(p.state);
          };
        })
        .catch((e) => pushDebug("mic permission query failed", { error: e.message }));
    }

    if (window.speechSynthesis) {
      const loadVoices = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      wantRecordingRef.current = false;
      destroyRecognition("unmount");
      releaseMediaStream();
      window.speechSynthesis?.cancel();
    };
  }, [destroyRecognition, pushDebug, releaseMediaStream]);

  /**
   * STEP 2 — Request mic permission via getUserMedia, then RELEASE the stream.
   * Chrome SpeechRecognition opens its own mic capture; an active MediaStream
   * holds exclusive device access on Windows → onstart fires but onresult never does.
   */
  const requestMic = useCallback(async () => {
    console.log(LOG, "STEP 2 permission: requestMic() entered", { micStatus });
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus("unsupported");
      setLastError("Microphone API not available in this browser.");
      pushDebug("STEP 2 FAIL getUserMedia unavailable");
      return false;
    }
    if (micStatus === "granted") {
      console.log(LOG, "STEP 2 permission: already granted (skip getUserMedia)");
      pushDebug("STEP 2 permission already granted");
      return true;
    }
    try {
      console.log(LOG, "STEP 2 permission: calling getUserMedia…");
      pushDebug("STEP 2 calling getUserMedia…");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log(LOG, "STEP 2 permission: granted — releasing test stream before SpeechRecognition");
      stream.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      setMicStreamActive(false);
      setMicStatus("granted");
      setLastError(null);
      pushDebug("STEP 2 permission granted, stream released for SR");
      return true;
    } catch (err) {
      const denied = err.name === "NotAllowedError" || err.name === "PermissionDeniedError";
      setMicStatus(denied ? "denied" : "unsupported");
      setLastError(ERROR_MESSAGES["not-allowed"]);
      console.log(LOG, "STEP 2 FAIL permission denied", err.name, err.message);
      pushDebug("STEP 2 FAIL", { name: err.name, message: err.message });
      return false;
    }
  }, [micStatus, pushDebug]);

  const waitForTTSIdle = useCallback((maxMs = 800) => new Promise((resolve) => {
    if (!ttsActiveRef.current && !window.speechSynthesis?.speaking) {
      resolve();
      return;
    }
    const start = Date.now();
    const tick = () => {
      if (!ttsActiveRef.current && !window.speechSynthesis?.speaking) {
        resolve();
        return;
      }
      if (Date.now() - start > maxMs) {
        pushDebug("TTS idle wait timeout — proceeding");
        resolve();
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  }), [pushDebug]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    ttsActiveRef.current = false;
    setSpeaking(false);
    pushDebug("TTS stopped");
  }, [pushDebug]);

  const speak = useCallback((text, { onDone } = {}) => {
    if (!text?.trim() || !window.speechSynthesis) {
      onDone?.();
      return;
    }
    stopSpeaking();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.95;
    utter.pitch = 1;

    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => v.lang.startsWith("en") && /google|natural|samantha|zira/i.test(v.name))
      || voices.find((v) => v.lang.startsWith("en"));
    if (preferred) utter.voice = preferred;

    utter.onstart = () => {
      ttsActiveRef.current = true;
      setSpeaking(true);
      pushDebug("TTS started");
    };
    utter.onend = () => {
      ttsActiveRef.current = false;
      setSpeaking(false);
      pushDebug("TTS ended");
      onDone?.();
    };
    utter.onerror = () => {
      ttsActiveRef.current = false;
      setSpeaking(false);
      pushDebug("TTS error");
      onDone?.();
    };
    window.speechSynthesis.speak(utter);
  }, [pushDebug, stopSpeaking]);

  const buildRecognition = useCallback(() => {
    console.log(LOG, "STEP 3 init: new SpeechRecognition()", {
      ctor: window.SpeechRecognition ? "SpeechRecognition" : "webkitSpeechRecognition",
    });
    const rec = new SR_Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      console.log(LOG, "STEP 4 recognition.onstart — session active, waiting for audio…");
      pushDebug("STEP 4 recognition.onstart");
      setRecording(true);
      setListenState("listening");
      setLastError(null);
    };

    rec.onspeechstart = () => {
      console.log(LOG, "STEP 4b onspeechstart — mic audio reaching recognizer");
      pushDebug("STEP 4b onspeechstart");
    };

    rec.onspeechend = () => {
      console.log(LOG, "STEP 4c onspeechend");
      pushDebug("STEP 4c onspeechend");
    };

    rec.onresult = (event) => {
      console.log(LOG, "STEP 5 recognition.onresult", {
        resultIndex: event.resultIndex,
        length: event.results.length,
      });
      pushDebug("STEP 5 recognition.onresult", { resultIndex: event.resultIndex, length: event.results.length });
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || "";
        pushDebug("result chunk", { i, isFinal: result.isFinal, text });
        if (result.isFinal) {
          finalBufferRef.current += text;
        } else {
          interim += text;
        }
      }
      emitTranscript(finalBufferRef.current, interim);
      setListenState("listening");
    };

    rec.onerror = (event) => {
      const code = event.error;
      console.log(LOG, "STEP 4 ERROR recognition.onerror", { code, message: event.message });
      pushDebug("STEP 4 ERROR recognition.onerror", { code, message: event.message });

      if (code === "aborted") return;

      if (code === "no-speech") {
        setListenState("listening");
        return;
      }

      const msg = ERROR_MESSAGES[code] || `Speech error: ${code}`;
      setLastError(msg);

      if (code === "not-allowed") {
        setMicStatus("denied");
        wantRecordingRef.current = false;
        setRecording(false);
        setListenState("error");
        destroyRecognition("not-allowed");
        releaseMediaStream();
        return;
      }

      if (code === "network" || code === "service-not-allowed") {
        wantRecordingRef.current = false;
        setRecording(false);
        setListenState("error");
        destroyRecognition(code);
      }
    };

    rec.onend = () => {
      pushDebug("recognition onend", { wantRecording: wantRecordingRef.current });
      setRecording(false);
      if (!wantRecordingRef.current) {
        setListenState("idle");
        return;
      }
      setListenState("processing");
      clearRestartTimer();
      restartTimerRef.current = setTimeout(() => {
        if (!wantRecordingRef.current || !buildRecognitionRef.current) return;
        try {
          destroyRecognition("restart");
          const next = buildRecognitionRef.current();
          recRef.current = next;
          pushDebug("recognition restart → start()");
          next.start();
        } catch (err) {
          pushDebug("recognition restart failed", { message: err.message });
          setListenState("error");
          setLastError(err.message || "Could not restart speech recognition");
          wantRecordingRef.current = false;
        }
      }, 300);
    };

    return rec;
  }, [clearRestartTimer, destroyRecognition, emitTranscript, pushDebug, releaseMediaStream]);

  useEffect(() => {
    buildRecognitionRef.current = buildRecognition;
  }, [buildRecognition]);

  const startListeningInternal = useCallback((onTranscript, { reset = true } = {}) => {
    if (!SR_Ctor) {
      setLastError("Speech recognition requires Chrome or Edge.");
      setListenState("error");
      console.log(LOG, "STEP 3 FAIL no SpeechRecognition constructor");
      pushDebug("STEP 3 FAIL no SpeechRecognition ctor");
      return false;
    }

    // Release any leftover getUserMedia stream — it blocks SpeechRecognition on Windows
    if (mediaStreamRef.current?.active) {
      console.log(LOG, "STEP 3 releasing active MediaStream so SpeechRecognition can capture mic");
      releaseMediaStream();
    }

    onTranscriptRef.current = onTranscript;
    wantRecordingRef.current = true;
    if (reset) {
      finalBufferRef.current = "";
      setTranscript("");
      setInterimText("");
    }
    setLastError(null);

    destroyRecognition("before-start");

    try {
      const rec = buildRecognition();
      recRef.current = rec;
      console.log(LOG, "STEP 4 calling recognition.start()");
      pushDebug("STEP 4 calling recognition.start()");
      rec.start();
      console.log(LOG, "STEP 4 recognition.start() returned (onstart should follow)");
      return true;
    } catch (err) {
      console.log(LOG, "STEP 4 FAIL recognition.start() threw", err.message);
      pushDebug("STEP 4 FAIL recognition.start() threw", { message: err.message });
      setLastError(err.message || "Could not start speech recognition");
      setListenState("error");
      wantRecordingRef.current = false;
      return false;
    }
  }, [buildRecognition, destroyRecognition, pushDebug, releaseMediaStream]);

  /**
   * Start STT after mic stream is open and TTS is idle.
   * Call from a user click handler.
   */
  const startListening = useCallback(async (onTranscript, opts = {}) => {
    console.log(LOG, "STEP 3 startListening entered");
    pushDebug("STEP 3 startListening entered");
    await waitForTTSIdle();
    console.log(LOG, "STEP 3 TTS idle — proceeding to recognition.start()");
    pushDebug("STEP 3 TTS idle");
    return startListeningInternal(onTranscript, opts);
  }, [pushDebug, startListeningInternal, waitForTTSIdle]);

  const stopListening = useCallback(() => {
    console.log(LOG, "stopListening");
    pushDebug("stopListening");
    wantRecordingRef.current = false;
    clearRestartTimer();
    destroyRecognition("user-stop");
    releaseMediaStream();
    setRecording(false);
    setListenState("idle");
    setInterimText("");
  }, [clearRestartTimer, destroyRecognition, pushDebug, releaseMediaStream]);

  const resetTranscript = useCallback(() => {
    finalBufferRef.current = "";
    setTranscript("");
    setInterimText("");
  }, []);

  const setTranscriptExternal = useCallback((text) => {
    finalBufferRef.current = text;
    setTranscript(text);
    setInterimText("");
  }, []);

  return {
    supported,
    micStatus,
    recording,
    speaking,
    listenState,
    transcript,
    interimText,
    lastError,
    debugEvents,
    hasMicStream: micStreamActive,
    clearError: () => setLastError(null),
    requestMic,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    resetTranscript,
    setTranscriptExternal,
  };
}
