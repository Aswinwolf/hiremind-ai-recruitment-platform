import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Upload, Play, FileText } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [me, setMe] = useState(null);
  const [history, setHistory] = useState([]);
  useEffect(() => {
    api.get("/api/candidate/me").then(r => setMe(r.data)).catch(() => {});
    api.get("/api/interview/history").then(r => setHistory(r.data)).catch(() => setHistory([]));
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="font-display text-3xl font-bold mb-1">Hi {user?.name?.split(" ")[0] || "there"} 👋</h1>
      <p className="text-slate-500 mb-8">Welcome back to your HireMind dashboard.</p>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Link to="/role-select" className="card hover:shadow-md transition">
          <Upload className="w-6 h-6 text-blue mb-3" />
          <div className="font-semibold">Pick / change role</div>
          <div className="text-sm text-slate-500">Current: {me?.selectedRole || "—"}</div>
        </Link>
        <Link to="/upload-resume" className="card hover:shadow-md transition">
          <FileText className="w-6 h-6 text-amber mb-3" />
          <div className="font-semibold">Upload resume</div>
          <div className="text-sm text-slate-500">ATS Score: {me?.atsScore ?? "—"}{me?.atsScore !== undefined ? "%" : ""}</div>
        </Link>
        <Link to={me?.isEligible ? "/interview" : "/ats-result"} className={`card hover:shadow-md transition ${!me?.isEligible ? "opacity-60" : ""}`}>
          <Play className="w-6 h-6 text-green mb-3" />
          <div className="font-semibold">{me?.isEligible ? "Start interview" : "Check eligibility"}</div>
          <div className="text-sm text-slate-500">{me?.isEligible ? "3 rounds · 9 questions" : "ATS must clear threshold first"}</div>
        </Link>
      </div>

      <h2 className="font-display text-xl font-bold mb-3">Recent interviews</h2>
      <div className="card">
        {history.length === 0 ? <div className="text-slate-500 text-sm">No interviews yet — start one above.</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wider">
                <th className="text-left py-2">Role</th><th className="text-left">Status</th><th className="text-left">Score</th><th className="text-left">Recommendation</th><th className="text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h._id} className="border-t border-slate-100">
                  <td className="py-2">{h.selectedRole}</td>
                  <td>{h.status}</td>
                  <td>{h.finalScores?.finalScore ?? "—"}</td>
                  <td>{h.recommendation ?? "—"}</td>
                  <td>{h.completedAt ? new Date(h.completedAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
