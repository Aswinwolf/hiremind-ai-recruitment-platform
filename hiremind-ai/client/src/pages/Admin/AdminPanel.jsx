import { useEffect, useState } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { Shield, Users, Briefcase, TrendingUp } from "lucide-react";

function Stat({ icon: I, label, value, color }) {
  return (
    <div className="card">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}><I className="w-5 h-5 text-white" /></div>
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [newRole, setNew] = useState({ title: "", skills: "", threshold: 60 });

  const load = async () => {
    setStats((await api.get("/api/admin/stats")).data);
    setUsers((await api.get("/api/admin/users")).data);
    setRoles((await api.get("/api/roles")).data);
  };
  useEffect(() => { load(); }, []);

  const promote = async (id, role) => {
    try { await api.post("/api/admin/promote", { userId: id, newRole: role }); toast.success("Updated"); load(); }
    catch (e) { toast.error(e.response?.data?.message || "Failed"); }
  };

  const addRole = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/admin/roles", {
        title: newRole.title,
        requiredSkills: newRole.skills.split(",").map(s => s.trim()).filter(Boolean),
        atsThreshold: Number(newRole.threshold),
      });
      toast.success("Role added"); setNew({ title: "", skills: "", threshold: 60 }); load();
    } catch (e) { toast.error(e.response?.data?.message || "Failed"); }
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="font-display text-3xl font-bold flex items-center gap-2 mb-6"><Shield className="w-7 h-7 text-blue" /> Admin Panel</h1>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <Stat icon={Users} label="Total users" value={stats?.totalUsers ?? "..."} color="bg-blue" />
        <Stat icon={Briefcase} label="Roles" value={stats?.totalRoles ?? "..."} color="bg-purple" />
        <Stat icon={TrendingUp} label="Interviews" value={stats?.totalInterviews ?? "..."} color="bg-green" />
        <Stat icon={Shield} label="Hire rate" value={(stats?.hireRate ?? "...") + (typeof stats?.hireRate === "number" ? "%" : "")} color="bg-amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="font-semibold mb-3">Users</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500"><th className="text-left">Name</th><th className="text-left">Email</th><th className="text-left">Role</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} className="border-t border-slate-100">
                  <td className="py-2">{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className="text-xs px-2 py-0.5 bg-slate-100 rounded">{u.role}</span></td>
                  <td className="text-right space-x-2">
                    {["candidate","hr","admin"].filter(r => r !== u.role).map(r => (
                      <button key={r} onClick={() => promote(u._id, r)} className="text-xs px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50">→ {r}</button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3">Roles</h2>
          <ul className="text-sm space-y-2 mb-4">
            {roles.map(r => (
              <li key={r._id} className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <div className="font-semibold">{r.title}</div>
                  <div className="text-xs text-slate-500">{(r.requiredSkills||[]).join(", ")}</div>
                </div>
                <div className="text-xs">Threshold {r.atsThreshold}%</div>
              </li>
            ))}
          </ul>
          <form onSubmit={addRole} className="space-y-2">
            <input className="input" placeholder="Title (e.g. Mobile Developer)" value={newRole.title} onChange={e=>setNew({...newRole, title:e.target.value})} required />
            <input className="input" placeholder="Skills (comma-separated)" value={newRole.skills} onChange={e=>setNew({...newRole, skills:e.target.value})} required />
            <input className="input" type="number" min="0" max="100" placeholder="Threshold %" value={newRole.threshold} onChange={e=>setNew({...newRole, threshold:e.target.value})} />
            <button className="btn-primary w-full">Add role</button>
          </form>
        </div>
      </div>
    </div>
  );
}
