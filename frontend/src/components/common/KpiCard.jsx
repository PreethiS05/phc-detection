import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkline } from "./Sparkline";
import { compact } from "../../lib/format";
import { cn } from "../../lib/utils";

const STATUS = {
  healthy: { dot: "bg-emerald-500", text: "text-emerald-700", chip: "bg-emerald-50 text-emerald-700", color: "#10B981", label: "Healthy" },
  warning: { dot: "bg-amber-500", text: "text-amber-700", chip: "bg-amber-50 text-amber-700", color: "#F59E0B", label: "Requires Attention" },
  critical: { dot: "bg-red-500", text: "text-red-700", chip: "bg-red-50 text-red-700", color: "#EF4444", label: "Critical" },
};

export function KpiCard({ kpi, onClick, testid }) {
  const s = STATUS[kpi.status] || STATUS.healthy;
  const up = kpi.trend === "up";
  const good = kpi.higher_better ? up : !up;
  const displayVal =
    kpi.unit === "%" ? `${kpi.value}%` : compact(kpi.value);
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className={cn(
        "group flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all",
        onClick && "hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{kpi.label}</span>
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", s.dot)} title={s.label} />
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <div className="font-mono text-2xl font-black tracking-tight text-slate-900 lg:text-3xl">
            {displayVal}
            {kpi.unit && kpi.unit !== "%" && (
              <span className="ml-1 text-xs font-semibold text-slate-400">{kpi.unit}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={cn("inline-flex items-center gap-0.5 rounded px-1 text-xs font-bold",
              good ? "text-emerald-600" : "text-red-600")}>
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(kpi.delta_pct)}%
            </span>
            <span className="text-[11px] text-slate-400">vs prev</span>
          </div>
        </div>
        <div className="h-10 w-24 shrink-0">
          <Sparkline data={kpi.sparkline} color={s.color} type="area" />
        </div>
      </div>
    </button>
  );
}
