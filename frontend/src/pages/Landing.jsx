import { useNavigate } from "react-router-dom";
import { HeartPulse, Eye, TrendingUp, Network, ArrowRight, ShieldCheck, Activity } from "lucide-react";

const CAPS = [
  { icon: Eye, title: "Real-Time Visibility", text: "Monitor medicine inventory, beds, personnel and patient footfall across the national PHC network — live.", color: "text-blue-600 bg-blue-50" },
  { icon: TrendingUp, title: "Predictive Intelligence", text: "Anticipate demand surges and identify potential stock-outs before they disrupt care delivery.", color: "text-emerald-600 bg-emerald-50" },
  { icon: Network, title: "Federated Collaboration", text: "Enable cross-state predictive modelling while keeping sensitive operational data local.", color: "text-indigo-600 bg-indigo-50" },
];

const STATS = [
  { k: "36", v: "States & UTs" }, { k: "113", v: "Districts" },
  { k: "505", v: "PHCs Monitored" }, { k: "51", v: "Medicines Tracked" },
];

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0B192C] text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
        <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />

        <header className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
              <HeartPulse className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-extrabold">Health Resilience</span>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-300 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> DPI · Prototype · Synthetic Data
          </div>
        </header>

        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-12 lg:pt-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-blue-200">
            <Activity className="h-3.5 w-3.5" /> Federated AI Platform for National Health Resource Intelligence
          </div>
          <h1 className="mt-6 max-w-4xl font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Smart Health & <span className="text-blue-400">Supply Chain</span> Resilience
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">
            AI-powered intelligence for a more resilient and responsive healthcare network — improving supply-chain
            resilience across India's Primary Health Centre network.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button onClick={() => navigate("/overview")} data-testid="enter-command-centre-btn"
              className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B192C]">
              Enter Command Centre
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <span className="text-sm text-slate-400">No login required for this demo</span>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.v} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="font-mono text-3xl font-black text-white">{s.k}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-slate-400">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-5 lg:grid-cols-3">
          {CAPS.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.title} className="rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-white/20">
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${c.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{c.text}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-10 text-center text-xs text-slate-500">
          Prototype for demonstration of "AI for Digital Public Infrastructure & Healthcare Governance". All data is
          synthetic. AI forecasts are simulated and clearly labelled. No real or personally identifiable patient data is used.
        </p>
      </div>
    </div>
  );
}
