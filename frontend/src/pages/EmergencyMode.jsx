import { useState } from "react";
import { toast } from "sonner";
import { Siren, Power, TrendingUp, BedDouble, Users, AlertTriangle, Truck, Lightbulb } from "lucide-react";
import { useApi, post } from "../lib/api";
import { useApp } from "../context/AppContext";
import { PageHeader, Section, AiTag } from "../components/common/PageHeader";
import { CardSkeleton, ErrorState } from "../components/common/Loaders";
import { StatusBadge } from "../components/common/StatusBadge";
import { SimulationControl } from "../components/common/SimulationControl";
import { num } from "../lib/format";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";

export default function EmergencyMode() {
  const { states, version, bump, refreshMeta } = useApp();
  const { data, loading, error, refetch } = useApi("/emergency-mode", null, [version]);
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState("Disease Outbreak");
  const [selStates, setSelStates] = useState(["MH", "KA", "TN"]);

  const active = data?.emergency?.active;

  const activate = async () => {
    const res = await post("/emergency-mode", { active: true, scenario, affected_states: selStates });
    toast.error(`Emergency mode activated: ${scenario}`, { icon: "🚨" });
    setOpen(false); refetch(); bump(); refreshMeta();
  };
  const deactivate = async () => {
    await post("/emergency-mode", { active: false });
    toast.success("Emergency mode deactivated. Systems normalising.");
    refetch(); bump(); refreshMeta();
  };

  if (loading) return <CardSkeleton rows={8} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="animate-fadeup">
      <PageHeader title="Surge / Emergency Mode"
        subtitle="Activate coordinated emergency response. Metrics, forecasts, risk scores and alerts update live across affected regions."
        actions={
          active ? (
            <Button onClick={deactivate} variant="outline" data-testid="deactivate-emergency-btn" className="border-slate-300">
              <Power className="mr-1.5 h-3.5 w-3.5" /> Deactivate
            </Button>
          ) : (
            <Button onClick={() => setOpen(true)} data-testid="activate-emergency-btn" className="bg-red-600 hover:bg-red-700">
              <Siren className="mr-1.5 h-3.5 w-3.5" /> Activate Emergency Mode
            </Button>
          )
        } />

      {!active ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Siren className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="mt-4 font-display text-lg font-bold text-slate-800">No active emergency</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Activate emergency mode to simulate a health emergency (outbreak, flood, heatwave, cyclone, epidemic, mass casualty) and coordinate the platform's response.
          </p>
          <div className="mt-6 flex justify-center"><SimulationControl /></div>
        </div>
      ) : (
        <>
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-600 px-5 py-4 text-white">
            <Siren className="h-6 w-6 animate-softpulse" />
            <div>
              <p className="font-display text-lg font-extrabold">EMERGENCY RESPONSE MODE ACTIVE</p>
              <p className="text-sm text-red-100">{data.emergency.scenario} · {data.affected_states.join(", ")} · {data.affected_districts} districts affected</p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Pressure icon={TrendingUp} label="Patient Footfall" value={`+${data.metrics.patient_footfall_pct}%`} tone="red" />
            <Pressure icon={TrendingUp} label="Medicine Demand" value={`+${data.metrics.medicine_demand_pct}%`} tone="red" />
            <Pressure icon={BedDouble} label="Bed Occupancy" value={`${data.metrics.bed_occupancy}%`} tone="amber" />
            <Pressure icon={Users} label="Personnel Shortage" value={`${data.metrics.personnel_shortage_pct}%`} tone="amber" />
            <Pressure icon={AlertTriangle} label="Critical PHCs" value={num(data.metrics.critical_phcs)} tone="red" />
            <Pressure icon={Truck} label="Logistics Capacity" value={`${data.metrics.logistics_capacity}%`} tone="green" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Section title="AI Response Recommendations" description="Prioritised coordination actions" actions={<AiTag />}>
                <div className="space-y-2.5">
                  {data.recommendations.map((r) => (
                    <div key={r.priority} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{r.priority}</span>
                      <p className="text-sm text-slate-700">{r.text}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
            <Section title="Critical Inventory Alerts">
              <div className="space-y-2">
                {data.critical_alerts.map((a, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-700">{a.medicine}</p><p className="truncate text-xs text-slate-400">{a.phc}</p></div>
                    <StatusBadge band="critical" label={`${a.risk_score}`} />
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <div className="mt-6"><SimulationControl /></div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle className="font-display">Activate Emergency Mode</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Scenario</label>
              <Select value={scenario} onValueChange={setScenario}>
                <SelectTrigger data-testid="emergency-scenario-select" className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {(data.scenarios || []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Affected States</label>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {states.map((s) => {
                  const on = selStates.includes(s.code);
                  return (
                    <button key={s.code} onClick={() => setSelStates((p) => on ? p.filter((c) => c !== s.code) : [...p, s.code])}
                      data-testid={`emergency-state-${s.code}`}
                      className={cn("rounded-md px-2 py-1 text-xs font-medium", on ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                      {s.code}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-slate-400">{selStates.length} states selected</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={activate} disabled={selStates.length === 0} data-testid="confirm-emergency-btn" className="bg-red-600 hover:bg-red-700">
              <Siren className="mr-1.5 h-3.5 w-3.5" /> Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Pressure({ icon: Icon, label, value, tone }) {
  const map = { red: "border-red-200 bg-red-50 text-red-700", amber: "border-amber-200 bg-amber-50 text-amber-700", green: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  return (
    <div className={cn("rounded-xl border p-4", map[tone])}>
      <Icon className="h-4 w-4" />
      <p className="mt-2 font-mono text-2xl font-black">{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-80">{label}</p>
    </div>
  );
}
