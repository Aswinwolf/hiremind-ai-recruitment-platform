import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { CheckCircle2, Download, TrendingUp, ShieldAlert } from "lucide-react";

const REC_COLORS = {
  "Highly Recommended": "bg-blue",
  "Recommended": "bg-green",
  "Consider with Training": "bg-amber",
  "Not Recommended": "bg-coral",
  "Needs Improvement": "bg-coral",
};

export default function InterviewComplete() {
  const [r, setR] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const cached = sessionStorage.getItem("lastResult");
        if (cached) {
          setR(JSON.parse(cached));
          setLoading(false);
          return;
        }
        const { data } = await api.get("/api/interview/latest-result");
        setR(data);
        sessionStorage.setItem("lastResult", JSON.stringify(data));
      } catch {
        setR(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const downloadReport = async () => {
    const res = await api.get("/api/candidate/report", { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "HireMind_Report.pdf";
    a.click();
  };

  if (loading) return <div className="p-8 text-slate-500">Loading result…</div>;
  if (!r) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <p className="text-slate-500 mb-4">No interview result found. Complete an interview and assessment first.</p>
        <Link to="/dashboard" className="btn-primary">Back to dashboard</Link>
      </div>
    );
  }

  const recColor = REC_COLORS[r.recommendation] || "bg-blue";
  const scores = r.scores || {};
  const indicators = r.assessment?.indicators || r.psychIndicators?.workplaceReadiness;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <CheckCircle2 className="w-12 h-12 text-green mb-3" />
      <h1 className="font-display text-3xl font-bold mb-2">Final evaluation report</h1>
      <p className="text-slate-500 mb-6">ATS, interviews, and workplace readiness combined.</p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Final score</div>
          <div className="text-5xl font-bold text-navy">{scores.finalScore ?? r.finalScore ?? 0}%</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Recommendation</div>
          <div className={`inline-block px-3 py-1 rounded-lg text-white font-semibold ${recColor}`}>{r.recommendation}</div>
          {r.decisionBrief?.hiringConfidenceScore !== undefined && (
            <div className="mt-3 text-sm text-slate-600">
              <TrendingUp className="inline w-4 h-4 mr-1" /> Hiring confidence:{" "}
              <span className="font-semibold">{r.decisionBrief.hiringConfidenceScore}/100</span>
            </div>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="font-semibold mb-3">Score breakdown</h3>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">ATS</span><span className="font-semibold">{scores.atsScore ?? "—"}%</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Technical interview</span><span className="font-semibold">{scores.technicalScore ?? "—"}%</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Behavioral interview</span><span className="font-semibold">{scores.behavioralScore ?? "—"}%</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Communication</span><span className="font-semibold">{scores.commScore ?? "—"}%</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Workplace readiness</span><span className="font-semibold">{scores.workplaceReadinessScore ?? r.assessment?.overallScore ?? "—"}%</span></div>
        </div>
      </div>

      {indicators && (
        <div className="card mb-4">
          <h3 className="font-semibold mb-1">Workplace indicators</h3>
          <p className="text-xs text-slate-500 mb-3">Workplace suitability signals only — not a clinical or mental-health evaluation.</p>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {Object.entries(indicators).map(([k, v]) => (
              <div key={k} className="flex justify-between capitalize">
                <span className="text-slate-500">{k.replace(/([A-Z])/g, " $1")}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
      {r.decisionBrief?.missingSkills?.length > 0 && (
        <div className="card mb-4">
          <h3 className="font-semibold mb-2">Missing skills</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">{r.decisionBrief.missingSkills.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      {r.decisionBrief?.riskFactors?.length > 0 && (
        <div className="card mb-4 border-coral/40 bg-coral/5">
          <h3 className="font-semibold mb-2 flex items-center gap-2 text-coral">
            <ShieldAlert className="w-4 h-4" /> Risk factors
          </h3>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {r.decisionBrief.riskFactors.map((f, i) => (
              <li key={i}><span className="font-mono">{f.code}</span> — {f.detail}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3">
        <button data-testid="download-report" onClick={downloadReport} className="btn-primary">
          <Download className="w-4 h-4" /> Download PDF report
        </button>
        <Link to="/dashboard" className="btn-ghost">Back to dashboard</Link>
      </div>
    </div>
  );
}
