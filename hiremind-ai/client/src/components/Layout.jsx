import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Brain, LogOut, BarChart3, Shield, LayoutDashboard } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const doLogout = async () => { await logout(); nav("/login"); };
  const role = user?.role;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-navy text-white shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue" />
            <span className="font-display font-bold text-lg">HireMind AI</span>
          </NavLink>
          <nav className="flex items-center gap-2 text-sm">
            <NavLink to="/dashboard" data-testid="nav-dashboard" className={({isActive}) => `px-3 py-1.5 rounded-lg ${isActive?"bg-blue":"hover:bg-white/10"}`}>
              <span className="inline-flex items-center gap-1.5"><LayoutDashboard className="w-4 h-4" /> Dashboard</span>
            </NavLink>
            {(role === "hr" || role === "admin") && (
              <>
                <NavLink to="/hr" data-testid="nav-hr" className={({isActive}) => `px-3 py-1.5 rounded-lg ${isActive?"bg-blue":"hover:bg-white/10"}`}>HR</NavLink>
                <NavLink to="/hr/analytics" data-testid="nav-analytics" className={({isActive}) => `px-3 py-1.5 rounded-lg ${isActive?"bg-blue":"hover:bg-white/10"}`}>
                  <span className="inline-flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> Analytics</span>
                </NavLink>
              </>
            )}
            {role === "admin" && (
              <NavLink to="/admin" data-testid="nav-admin" className={({isActive}) => `px-3 py-1.5 rounded-lg ${isActive?"bg-blue":"hover:bg-white/10"}`}>
                <span className="inline-flex items-center gap-1.5"><Shield className="w-4 h-4" /> Admin</span>
              </NavLink>
            )}
            <span className="ml-4 text-muted text-xs">{user?.name} · {role}</span>
            <button data-testid="logout-btn" onClick={doLogout} className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-coral/90 hover:bg-coral">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        HireMind AI © {new Date().getFullYear()} — Powered by Gemini 2.5 Flash
      </footer>
    </div>
  );
}
