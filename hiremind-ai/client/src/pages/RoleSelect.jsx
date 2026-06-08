import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../services/api";
import { Briefcase } from "lucide-react";

export default function RoleSelect() {
  const [roles, setRoles] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => { (async () => {
    try { const { data } = await api.get("/api/roles"); setRoles(data); }
    catch { toast.error("Could not load roles. Make sure to run npm run seed:roles."); }
  })(); }, []);

  const submit = async () => {
    if (!selected) return toast.error("Pick a role");
    setLoading(true);
    try {
      await api.post("/api/candidate/select-role", { selectedRole: selected });
      toast.success("Role saved");
      nav("/upload-resume");
    } catch (e) { toast.error(e.response?.data?.message || "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="font-display text-3xl font-bold mb-2">Pick the role you're applying for</h1>
      <p className="text-slate-500 mb-8">The AI will tailor the ATS check and the interview to this role.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {roles.map(r => (
          <button key={r._id} onClick={() => setSelected(r.title)} data-testid={`role-${r.title.replace(/\s+/g,"-").toLowerCase()}`}
            className={`text-left card transition ${selected === r.title ? "ring-2 ring-blue border-blue" : "hover:shadow-md"}`}>
            <Briefcase className="w-6 h-6 text-blue mb-3" />
            <div className="font-semibold mb-1">{r.title}</div>
            <div className="text-xs text-slate-500 mb-2">Threshold: {r.atsThreshold}%</div>
            <div className="flex flex-wrap gap-1.5">
              {(r.requiredSkills || []).slice(0, 5).map(s => <span key={s} className="px-2 py-0.5 bg-slate-100 rounded text-xs">{s}</span>)}
            </div>
          </button>
        ))}
      </div>
      <button data-testid="role-continue" disabled={loading || !selected} onClick={submit} className="btn-primary">Continue</button>
    </div>
  );
}
