import { useEffect, useState } from "react";
import api from "../../services/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function Stat({ label, value }) {
  return <div className="card"><div className="text-xs uppercase tracking-wider text-slate-500">{label}</div><div className="text-3xl font-bold mt-1">{value}</div></div>;
}

export default function HRAnalytics() {
  const [iv, setIv] = useState(null);
  const [ats, setAts] = useState([]);
  useEffect(() => {
    api.get("/api/analytics/interviews").then(r => setIv(r.data)).catch(() => {});
    api.get("/api/analytics/ats").then(r => setAts(r.data)).catch(() => {});
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="font-display text-3xl font-bold mb-6">HR Analytics — last 30 days</h1>
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Stat label="Interviews started" value={iv?.total ?? "..."} />
        <Stat label="Completed" value={iv?.completed ?? "..."} />
        <Stat label="Avg final score" value={iv?.avgScore ?? "..."} />
      </div>

      <div className="card mb-6">
        <h3 className="font-semibold mb-3">Average final score by role</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={iv?.byRole || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="_id" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="avg" fill="#1E88E5" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">ATS eligibility rate (%) by role</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={ats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="role" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="eligibilityRate" fill="#27AE60" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
