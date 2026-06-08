import { useEffect, useState } from "react";
import api from "../../services/api";
import { Users, Search } from "lucide-react";

export default function HRDashboard() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const load = async () => { const { data } = await api.get("/api/hr/candidates"); setRows(data); };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r =>
    !q || (r.name||"").toLowerCase().includes(q.toLowerCase()) || (r.email||"").toLowerCase().includes(q.toLowerCase()) || (r.role||"").toLowerCase().includes(q.toLowerCase())
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
          <input className="input pl-9 w-72" placeholder="Search name / role / email" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wider">
              <th className="text-left py-2">Name</th><th className="text-left">Role</th><th className="text-left">ATS</th><th className="text-left">Final</th><th className="text-left">HCS</th><th className="text-left">Recommendation</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="py-2">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.email}</div>
                </td>
                <td>{c.role}</td>
                <td>{c.atsScore}%</td>
                <td>{c.finalScore ?? "—"}</td>
                <td>{c.hcs ?? "—"}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    c.recommendation === "Highly Recommended" ? "bg-blue/10 text-blue" :
                    c.recommendation === "Recommended" ? "bg-green/10 text-green" :
                    c.recommendation === "Needs Improvement" ? "bg-coral/10 text-coral" : "bg-slate-100 text-slate-500"
                  }`}>{c.recommendation}</span>
                </td>
                <td>{c.interviewId && <button onClick={() => dl(c.id)} className="text-blue hover:underline text-xs">Download</button>}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="7" className="text-center py-8 text-slate-400">No candidates</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
