import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { CheckCircle2, Download, TrendingUp, ShieldAlert } from "lucide-react";

export default function InterviewComplete() {
  const [r, setR] = useState(null);
  useEffect(() => {
    try { setR(JSON.parse(sessionStorage.getItem("lastResult") || "null")); }
    catch { setR(null); }
  }, []);

  const downloadReport = async () => {
    const res = await api.get("/api/candidate/report", { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a"); a.href = url; a.download = "HireMind_Report.pdf"; a.click();
  };

  if (!r) return <div className="p-8 text-slate-500">Loading result…</div>;
  const recColor = { "Highly Recommended": "bg-blue", "Recommended": "bg-green", "Needs Improvement": "bg-coral" }[r.recommendation] || "bg-blue";

  return (
    <div className="max-w-3xl mx-auto p-8">
      <CheckCircle2 className="w-12 h-12 text-green mb-3" />
      <h1 className="font-display text-3xl font-bold mb-2">Interview complete</h1>
      <p className="text-slate-500 mb-6">Your detailed scoring, behavioural profile and recruiter brief are ready.</p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Final score</div>
          <div className="text-5xl font-bold text-navy">{r.scores?.finalScore ?? 0}%</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Recommendation</div>
          <div className={`inline-block px-3 py-1 rounded-lg text-white font-semibold ${recColor}`}>{r.recommendation}</div>
          {r.decisionBrief?.hiringConfidenceScore !== undefined && (
            <div className="mt-3 text-sm text-slate-600"><TrendingUp className="inline w-4 h-4 mr-1" /> Hiring confidence: <span className="font-semibold">{r.decisionBrief.hiringConfidenceScore}/100</span></div>
          )}
        </div>
      </div>

      {r.decisionBrief?.strengths?.length > 0 && (
        <div className="card mb-4">
          <h3 className="font-semibold mb-2">Strengths</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">{r.decisionBrief.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      {r.decisionBrief?.weaknesses?.length > 0 && (
        <div className="card mb-4">
          <h3 className="font-semibold mb-2">Areas to improve</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">{r.decisionBrief.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      {r.decisionBrief?.riskFactors?.length > 0 && (
        <div className="card mb-4 border-coral/40 bg-coral/5">
          <h3 className="font-semibold mb-2 flex items-center gap-2 text-coral"><ShieldAlert className="w-4 h-4" /> Risk factors</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">{r.decisionBrief.riskFactors.map((f, i) => <li key={i}><span className="font-mono">{f.code}</span> — {f.detail}</li>)}</ul>
        </div>
      )}

      <div className="flex gap-3">
        <button data-testid="download-report" onClick={downloadReport} className="btn-primary"><Download className="w-4 h-4" /> Download PDF report</button>
        <Link to="/dashboard" className="btn-ghost">Back to dashboard</Link>
      </div>
    </div>
  );
}
