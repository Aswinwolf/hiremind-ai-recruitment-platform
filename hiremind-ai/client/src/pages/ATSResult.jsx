import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Check, X, ArrowRight } from "lucide-react";

export default function ATSResult() {
  const [c, setC] = useState(null);
  const nav = useNavigate();
  useEffect(() => { (async () => {
    const { data } = await api.get("/api/candidate/me"); setC(data);
  })(); }, []);
  if (!c) return <div className="p-8 text-slate-500">Loading…</div>;
  const eligible = c.isEligible;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="font-display text-3xl font-bold mb-1">ATS Result</h1>
      <p className="text-slate-500 mb-6">For role: <span className="font-semibold">{c.selectedRole}</span></p>
      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white ${eligible ? "bg-green" : "bg-coral"}`}>{c.atsScore}%</div>
          <div>
            <div className="text-sm text-slate-500">ATS Score</div>
            <div className={`text-xl font-semibold ${eligible ? "text-green" : "text-coral"}`}>{eligible ? "Eligible for interview" : "Below threshold"}</div>
          </div>
        </div>
        {c.missingSkills?.length > 0 && (
          <div>
            <div className="text-sm font-semibold mb-2">Missing skills</div>
            <div className="flex flex-wrap gap-2">
              {c.missingSkills.map(s => <span key={s} className="px-2.5 py-1 bg-amber/10 text-amber rounded-lg text-xs font-medium">{s}</span>)}
            </div>
          </div>
        )}
      </div>
      {eligible ? (
        <button data-testid="ats-start-interview" onClick={() => nav("/interview")} className="btn-primary"><Check className="w-4 h-4" /> Start Interview <ArrowRight className="w-4 h-4" /></button>
      ) : (
        <div className="card bg-coral/5 border-coral/20">
          <X className="w-6 h-6 text-coral mb-2" />
          <div className="font-semibold mb-1">Improve your resume and try again</div>
          <p className="text-sm text-slate-500">Focus on the missing skills above. Add concrete projects and quantify outcomes.</p>
        </div>
      )}
    </div>
  );
}
