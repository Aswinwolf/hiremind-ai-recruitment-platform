import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { Brain } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success("Welcome back!");
      nav(user.role === "candidate" ? "/dashboard" : user.role === "hr" ? "/hr" : "/admin");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-navy text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-2"><Brain className="w-7 h-7 text-blue" /><span className="font-display font-bold text-xl">HireMind AI</span></div>
        <div>
          <h2 className="font-display text-4xl font-bold mb-4">Welcome back.</h2>
          <p className="text-muted">Pick up where you left off — your last interview, your last candidate, your last decision.</p>
        </div>
        <div className="text-xs text-muted">© {new Date().getFullYear()} HireMind AI</div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <h1 className="font-display text-2xl font-bold">Sign in</h1>
          <div><label className="label">Email</label><input data-testid="login-email" className="input" value={email} onChange={e=>setEmail(e.target.value)} required type="email" /></div>
          <div><label className="label">Password</label><input data-testid="login-password" className="input" value={password} onChange={e=>setPassword(e.target.value)} required type="password" /></div>
          <button data-testid="login-submit" disabled={loading} className="btn-primary w-full">{loading ? "Signing in..." : "Sign in"}</button>
          <p className="text-sm text-slate-500">No account? <Link to="/register" className="text-blue font-semibold">Create one</Link></p>
        </form>
      </div>
    </div>
  );
}
