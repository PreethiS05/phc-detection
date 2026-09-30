import { toast } from "sonner";
import { ShieldCheck, Users, Database, RotateCcw, Lock, Server } from "lucide-react";
import { post } from "../lib/api";
import { useApp } from "../context/AppContext";
import { PageHeader, Section } from "../components/common/PageHeader";
import { SimulationControl } from "../components/common/SimulationControl";
import { StatusBadge } from "../components/common/StatusBadge";
import { Button } from "../components/ui/button";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "../components/ui/dialog";

const ROLES = [
  { role: "Administrator", scope: "Full platform + settings & audit", access: ["All modules", "Simulation", "Emergency", "Reports"] },
  { role: "National Health Officer", scope: "National view, all states", access: ["Overview", "Analytics", "Reports", "Emergency"] },
  { role: "State Health Officer", scope: "Single state + its districts", access: ["State PHCs", "Inventory", "Forecast", "Transfers"] },
  { role: "District Health Officer", scope: "Single district", access: ["District PHCs", "Inventory", "Warnings"] },
  { role: "PHC Administrator", scope: "Own facility only", access: ["PHC dashboard", "Inventory", "Reorder"] },
];

export default function Settings() {
  const { bump } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const reset = async () => {
    setResetting(true);
    try {
      await post("/reset");
      toast.success("Synthetic dataset reset to baseline.");
      setConfirmReset(false); bump();
    } catch { toast.error("Reset failed"); }
    finally { setResetting(false); }
  };

  return (
    <div className="animate-fadeup">
      <PageHeader title="Settings & Audit Log"
        subtitle="Role-based access, data privacy posture, and demo controls for this prototype." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Role-Based Access Control (RBAC)" description="Five roles with scoped access. Switch active role from the top bar.">
            <div className="space-y-3">
              {ROLES.map((r) => (
                <div key={r.role} className="rounded-lg border border-slate-100 p-4" data-testid={`role-row-${r.role.replace(/\s+/g, "-").toLowerCase()}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-semibold text-slate-800">{r.role}</p>
                    </div>
                    <span className="text-xs text-slate-400">{r.scope}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.access.map((a) => <span key={a} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{a}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Data Privacy & Architecture" description="Healthcare privacy principles applied to this prototype">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Principle icon={Lock} title="No PII" text="No personally identifiable patient information. Only aggregated synthetic statistics are used." />
              <Principle icon={Database} title="Separated data layers" text="Operational data, analytics data and AI model outputs are clearly separated." />
              <Principle icon={ShieldCheck} title="Federated by design" text="States train models locally; only model updates are aggregated — raw data stays local (simulated)." />
              <Principle icon={Server} title="Synthetic dataset" text="36 states, 113 districts, 505 PHCs, 51 medicines and thousands of inventory records." />
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Demo Simulation"><SimulationControl compact /></Section>

          <Section title="Data Controls">
            <p className="text-xs text-slate-500">Reset all simulated inventory, transfers, emergency and simulation state back to the deterministic baseline.</p>
            <Button variant="outline" className="mt-3 w-full border-red-200 text-red-600 hover:bg-red-50" onClick={() => setConfirmReset(true)} data-testid="reset-data-btn">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset Synthetic Data
            </Button>
          </Section>

          <Section title="System Status">
            <div className="space-y-2 text-sm">
              {[["Backend API", "healthy"], ["Federated Nodes", "healthy"], ["Data Sync", "healthy"], ["AI Forecast Engine", "warning"]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-slate-600">{k}</span>
                  <StatusBadge band={v} label={v === "healthy" ? "Operational" : "Simulated"} />
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="font-display">Reset synthetic data?</DialogTitle>
            <DialogDescription className="text-slate-500">This regenerates the full dataset and clears all transfers, emergencies and active simulations. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={reset} disabled={resetting} data-testid="confirm-reset-btn">
              {resetting ? "Resetting…" : "Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Principle({ icon: Icon, title, text }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <Icon className="h-4 w-4 text-blue-600" />
      <p className="mt-1.5 text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{text}</p>
    </div>
  );
}
