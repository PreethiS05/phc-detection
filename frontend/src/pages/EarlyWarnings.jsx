import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeftRight, ArrowUpCircle, Calendar, Activity } from "lucide-react";
import { useApi } from "../lib/api";
import { useApp } from "../context/AppContext";
import { PageHeader, AiTag } from "../components/common/PageHeader";
import { CardSkeleton, EmptyState, ErrorState } from "../components/common/Loaders";
import { StatusBadge } from "../components/common/StatusBadge";
import { num, fmtDate, riskStyle } from "../lib/format";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";

const BANDS = [
  { key: "", label: "All" }, { key: "critical", label: "Critical (81-100)" },
  { key: "high", label: "High (61-80)" }, { key: "moderate", label: "Moderate (31-60)" },
];

export default function EarlyWarnings() {
  const { stateCode, version } = useApp();
  const [band, setBand] = useState("");
  const { data, loading, error, refetch } = useApi("/alerts",
    { risk: band || undefined, state_code: stateCode || undefined, limit: 40 },
    [band, stateCode, version]);

  return (
    <div className="animate-fadeup">
      <PageHeader title="Early Warning System" badge={<AiTag />}
        subtitle="AI-detected potential stock-outs ranked by risk score. Each warning explains the reasoning and a recommended action." />

      {data && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <CountCard band="critical" label="Critical" value={data.counts.critical} />
          <CountCard band="high" label="High Risk" value={data.counts.high} />
          <CountCard band="moderate" label="Moderate" value={data.counts.moderate} />
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {BANDS.map((b) => (
          <button key={b.key} onClick={() => setBand(b.key)} data-testid={`warning-filter-${b.key || "all"}`}
            className={cn("rounded-lg border px-3 py-1.5 text-sm font-medium",
              band === b.key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
            {b.label}
          </button>
        ))}
      </div>

      {loading && <div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {data && data.alerts.length === 0 && <EmptyState icon={AlertTriangle} title="No warnings in range" description="No stock-out risks match the selected filter." testid="warnings-empty" />}

      {data && data.alerts.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.alerts.map((a, i) => {
            const s = riskStyle(a.risk_band);
            return (
              <div key={a.id} data-testid={`warning-card-${i}`}
                className={cn("overflow-hidden rounded-xl border bg-white shadow-sm", s.border)}>
                <div className={cn("flex items-center justify-between px-5 py-3", s.bg)}>
                  <span className={cn("inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide", s.text)}>
                    <AlertTriangle className="h-4 w-4" /> {s.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Risk score</span>
                    <span className={cn("font-mono text-xl font-black", s.text)}>{a.risk_score}</span>
                  </div>
                </div>
                <div className="p-5">
                  <p className="font-display text-base font-bold text-slate-800">
                    {a.medicine} shortage predicted at {a.phc}
                  </p>
                  <p className="text-xs text-slate-500">{a.district}, {a.state}</p>

                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                    <Stat label="Current stock" value={`${num(a.effective_stock)}`} />
                    <Stat label="Daily use" value={`${num(a.effective_daily_consumption)}`} />
                    <Stat label="Days remaining" value={a.days_remaining} highlight />
                    <Stat label="Surge prob." value={`${Math.round(a.surge_probability * 100)}%`} />
                  </div>

                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    Predicted stock-out: <b className="font-mono text-slate-800">{fmtDate(a.predicted_stockout_date)}</b>
                  </div>

                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700">AI reasoning</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{a.explanation}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-700">Recommended: {a.recommended_action_detail}</p>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button size="sm" data-testid={`transfer-action-${i}`} className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => toast.success(`Inter-district transfer initiated for ${a.medicine}`)}>
                      <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" /> Trigger Transfer
                    </Button>
                    <Button size="sm" variant="outline" data-testid={`escalate-action-${i}`}
                      onClick={() => toast.info(`Escalated ${a.medicine} at ${a.phc} to State Nodal Officer`)}>
                      <ArrowUpCircle className="mr-1.5 h-3.5 w-3.5" /> Escalate to State
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CountCard({ band, label, value }) {
  const s = riskStyle(band);
  return (
    <div className={cn("rounded-xl border p-4", s.border, s.bg)}>
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} />
        <p className={cn("text-xs font-bold uppercase tracking-wide", s.text)}>{label}</p>
      </div>
      <p className="mt-2 font-mono text-3xl font-black text-slate-900">{num(value)}</p>
      <p className="text-xs text-slate-500">active warnings</p>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={cn("font-mono text-sm font-bold", highlight ? "text-red-600" : "text-slate-800")}>{value}</p>
    </div>
  );
}
