import { Link } from "react-router-dom";
import { Brain, Mic, FileText, BarChart3, ShieldCheck, Sparkles } from "lucide-react";
export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy to-slate-900 text-white">
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2"><Brain className="w-7 h-7 text-blue" /><span className="font-display font-bold text-xl">HireMind AI</span></div>
        <div className="flex gap-2">
          <Link to="/login" data-testid="landing-login" className="px-4 py-2 rounded-xl hover:bg-white/10 text-sm">Login</Link>
          <Link to="/register" data-testid="landing-register" className="px-4 py-2 rounded-xl bg-blue text-sm font-semibold">Get Started</Link>
        </div>
      </header>
      <section className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-block px-3 py-1 bg-blue/20 border border-blue/40 rounded-full text-xs text-blue mb-5">Powered by Gemini 2.5 Flash</span>
          <h1 className="font-display text-4xl lg:text-6xl font-bold leading-tight mb-5">Hire smarter. <br/><span className="text-blue">Interview faster.</span></h1>
          <p className="text-muted text-lg max-w-lg mb-7">AI-driven resume screening, multi-round voice interviews, behavioural intelligence and recruiter briefs — all in one place.</p>
          <div className="flex gap-3">
            <Link to="/register" className="btn-primary">Start free</Link>
            <Link to="/login" className="btn-ghost text-white bg-transparent border-white/20 hover:bg-white/10">Sign in</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: FileText,   t: "Resume Parser",   d: "PDF parsing + skill extraction" },
            { icon: Sparkles,   t: "ATS Match",       d: "Semantic skill scoring" },
            { icon: Mic,        t: "Voice Interview", d: "3 rounds · 9 questions" },
            { icon: BarChart3,  t: "Decision Brief",  d: "Strengths · Risks · HCS" },
            { icon: ShieldCheck,t: "Guardrails",      d: "Anti-injection · anti-paste" },
            { icon: Brain,      t: "Behaviour",       d: "STAR-based traits scoring" },
          ].map(({icon:I,t,d},i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <I className="w-6 h-6 text-blue mb-3" />
              <div className="font-semibold">{t}</div>
              <div className="text-muted text-xs">{d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
