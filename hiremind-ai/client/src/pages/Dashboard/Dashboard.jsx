import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Upload, Play, FileText, ClipboardList } from "lucide-react";

function assessmentLabel(status) {
  if (status === "completed") return { text: "Completed", color: "text-green" };
  if (status === "in-progress") return { text: "In Progress", color: "text-amber" };
  if (status === "not-started") return { text: "Ready — start now", color: "text-blue" };
  return { text: "Not Started", color: "text-slate-500" };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [me, setMe] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeInterview, setActiveInterview] = useState(null);
  const [assessmentStatus, setAssessmentStatus] = useState({ status: "unavailable" });

  useEffect(() => {
    api.get("/api/candidate/me").then((r) => setMe(r.data)).catch(() => {});
    api.get("/api/interview/history").then((r) => setHistory(r.data)).catch(() => setHistory([]));
    api.get("/api/interview/active").then((r) => setActiveInterview(r.data?.active ? r.data : null)).catch(() => {});
    api.get("/api/behavior-assessment/status").then((r) => setAssessmentStatus(r.data)).catch(() => {});
  }, []);

  const assess = assessmentLabel(assessmentStatus.status);
  const assessmentLink = assessmentStatus.status === "completed"
    ? "/interview/complete"
    : assessmentStatus.status === "in-progress" || assessmentStatus.status === "not-started"
      ? "/behavior-assessment"
      : "/dashboard";

  const interviewLink = activeInterview?.phase === "assessment"
    ? "/behavior-assessment"
    : me?.isEligible ? "/interview" : "/ats-result";

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="font-display text-3xl font-bold mb-1">Hi {user?.name?.split(" ")[0] || "there"} 👋</h1>
      <p className="text-slate-500 mb-8">Welcome back to your HireMind dashboard.</p>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
        <Link to={interviewLink} className={`card hover:shadow-md transition ${!me?.isEligible ? "opacity-60" : ""}`}>
          <Play className="w-6 h-6 text-green mb-3" />
          <div className="font-semibold">
            {activeInterview?.phase === "assessment"
              ? "Continue assessment"
              : me?.isEligible
                ? (activeInterview ? "Resume interview" : "Start interview")
                : "Check eligibility"}
          </div>
          <div className="text-sm text-slate-500">
            {me?.isEligible
              ? (activeInterview?.phase === "assessment"
                ? "Workplace readiness pending"
                : activeInterview
                  ? `${activeInterview.progress?.percent ?? 0}% complete`
                  : "Technical · Resume · Behavioral")
              : "ATS must clear threshold first"}
          </div>
        </Link>
        <Link
          to={assessmentLink}
          className={`card hover:shadow-md transition ${
            assessmentStatus.status === "unavailable" ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          <ClipboardList className="w-6 h-6 text-purple-600 mb-3" />
          <div className="font-semibold">Behavior Assessment</div>
          <div className={`text-sm font-medium ${assess.color}`}>{assess.text}</div>
          {assessmentStatus.status === "completed" && assessmentStatus.overallScore != null && (
            <div className="text-xs text-slate-500 mt-1">Score: {assessmentStatus.overallScore}/100</div>
          )}
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
              {history.map((h) => (
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
