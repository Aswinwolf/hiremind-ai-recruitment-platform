import { useEffect, useState } from "react";
import api from "../../services/api";
import { Users, Search } from "lucide-react";

const REC_CLASS = {
  "Highly Recommended": "bg-blue/10 text-blue",
  "Recommended": "bg-green/10 text-green",
  "Consider with Training": "bg-amber/10 text-amber",
  "Not Recommended": "bg-coral/10 text-coral",
  "Needs Improvement": "bg-coral/10 text-coral",
};

export default function HRDashboard() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const load = async () => { const { data } = await api.get("/api/hr/candidates"); setRows(data); };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) =>
    !q || (r.name || "").toLowerCase().includes(q.toLowerCase())
      || (r.email || "").toLowerCase().includes(q.toLowerCase())
      || (r.role || "").toLowerCase().includes(q.toLowerCase())
  );

  const dl = async (id) => {
    const r = await api.get(`/api/hr/report/${id}`, { responseType: "blob" });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a"); a.href = url; a.download = "HireMind_Report.pdf"; a.click();
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2"><Users className="w-7 h-7 text-blue" /> Candidates</h1>
          <p className="text-slate-500">{rows.length} total</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input className="input pl-9 w-72" placeholder="Search name / role / email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wider">
              <th className="text-left py-2">Name</th>
              <th className="text-left">Role</th>
              <th className="text-left">ATS</th>
              <th className="text-left">Final</th>
              <th className="text-left">Workplace</th>
              <th className="text-left">HCS</th>
              <th className="text-left">Recommendation</th>
              <th className="text-left">Indicators</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="py-2">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.email}</div>
                </td>
                <td>{c.role}</td>
                <td>{c.atsScore}%</td>
                <td className="font-semibold">{c.finalScore ?? "—"}</td>
                <td>{c.workplaceReadinessScore ?? "—"}</td>
                <td>{c.hcs ?? "—"}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${REC_CLASS[c.recommendation] || "bg-slate-100 text-slate-500"}`}>
                    {c.recommendation}
                  </span>
                </td>
                <td className="text-xs text-slate-600 max-w-[140px]">
                  {c.workplaceIndicators
                    ? Object.entries(c.workplaceIndicators).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(", ")
                    : "—"}
                </td>
                <td>{c.interviewId && <button onClick={() => dl(c.id)} className="text-blue hover:underline text-xs">PDF</button>}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="9" className="text-center py-8 text-slate-400">No candidates</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
