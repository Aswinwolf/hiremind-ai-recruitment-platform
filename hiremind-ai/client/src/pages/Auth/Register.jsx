import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { Brain } from "lucide-react";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(name, email, password);
      toast.success("Account created!");
      nav("/role-select");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-navy text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-2"><Brain className="w-7 h-7 text-blue" /><span className="font-display font-bold text-xl">HireMind AI</span></div>
        <div>
          <h2 className="font-display text-4xl font-bold mb-4">Get hired smarter.</h2>
          <p className="text-muted">Upload your resume, pick a role, and let AI run a fair, structured mock interview.</p>
        </div>
        <div className="text-xs text-muted">© {new Date().getFullYear()} HireMind AI</div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <h1 className="font-display text-2xl font-bold">Create your account</h1>
          <div><label className="label">Name</label><input data-testid="register-name" className="input" value={name} onChange={e=>setName(e.target.value)} required /></div>
          <div><label className="label">Email</label><input data-testid="register-email" className="input" value={email} onChange={e=>setEmail(e.target.value)} required type="email" /></div>
          <div>
            <label className="label">Password</label>
            <input data-testid="register-password" className="input" value={password} onChange={e=>setPassword(e.target.value)} required type="password" />
            <p className="text-xs text-slate-400 mt-1">Min 10 chars, upper + lower + number + symbol</p>
          </div>
          <button data-testid="register-submit" disabled={loading} className="btn-primary w-full">{loading ? "Creating..." : "Create account"}</button>
          <p className="text-sm text-slate-500">Already a user? <Link to="/login" className="text-blue font-semibold">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
