import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Truck, Boxes, TrendingUp, AlertTriangle, ArrowLeftRight,
  Building2, Cpu, Siren, BarChart3, FileSpreadsheet, ShieldCheck, HeartPulse, X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useApp } from "../../context/AppContext";

const NAV = [
  { to: "/overview", label: "National Overview", icon: LayoutDashboard, badge: "LIVE", testid: "overview" },
  { to: "/supply-chain", label: "Supply Chain", icon: Truck, testid: "supply-chain" },
  { to: "/inventory", label: "Inventory Matrix", icon: Boxes, testid: "inventory" },
  { to: "/demand-forecast", label: "Demand Forecast", icon: TrendingUp, badge: "AI", testid: "demand-forecast" },
  { to: "/early-warnings", label: "Early Warnings", icon: AlertTriangle, testid: "early-warnings" },
  { to: "/resource-allocation", label: "Resource Allocation", icon: ArrowLeftRight, testid: "resource-allocation" },
  { to: "/phc-network", label: "PHC Network", icon: Building2, testid: "phc-network" },
  { to: "/federated-ai", label: "Federated AI", icon: Cpu, badge: "36", testid: "federated-ai" },
  { to: "/emergency", label: "Emergency Mode", icon: Siren, testid: "emergency-mode" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, testid: "analytics" },
  { to: "/reports", label: "Reports", icon: FileSpreadsheet, testid: "reports" },
  { to: "/settings", label: "Settings", icon: ShieldCheck, testid: "settings" },
];

export function Sidebar({ open, onClose }) {
  const { emergency } = useApp();
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} />}
      <aside
        data-testid="sidebar"
        className={cn(
          "fixed left-0 top-0 z-40 flex h-full w-64 flex-col bg-[#0B192C] text-slate-300 transition-transform xl:w-72",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
            <HeartPulse className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-extrabold text-white">Health Resilience</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Command Centre</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={onClose} data-testid="sidebar-close">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isEmergency = item.to === "/emergency" && emergency?.active;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                data-testid={`sidebar-${item.testid}-link`}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive ? "bg-blue-600 text-white shadow" : "text-slate-300 hover:bg-white/5 hover:text-white",
                    isEmergency && !isActive && "text-red-300"
                  )
                }
              >
                <Icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">{item.badge}</span>
                )}
                {isEmergency && <span className="h-2 w-2 rounded-full bg-red-500 animate-softpulse" />}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Prototype</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Synthetic data only. AI outputs are simulated & clearly labelled. No real patient data.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
