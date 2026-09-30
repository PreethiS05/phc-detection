import { useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Play, Trash2, Zap } from "lucide-react";
import { post, useApi } from "../../lib/api";
import { useApp } from "../../context/AppContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { Slider } from "../ui/slider";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export function SimulationControl({ compact = false }) {
  const { states, bump } = useApp();
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState("patient_surge");
  const [scope, setScope] = useState("");
  const [magnitude, setMagnitude] = useState([1]);
  const { data, refetch } = useApi("/simulations");

  const scenarios = data?.available || [];
  const active = data?.simulations || [];

  const run = async () => {
    try {
      const res = await post("/simulate", {
        scenario, state_code: scope || null, magnitude: magnitude[0],
      });
      toast.success(res.message);
      setOpen(false);
      refetch();
      bump();
    } catch (e) {
      toast.error("Could not run simulation");
    }
  };

  const clear = async () => {
    await post("/simulate/clear");
    toast.success("All simulations cleared. Dashboards restored.");
    refetch();
    bump();
  };

  return (
    <div className={cn(!compact && "rounded-xl border border-slate-200 bg-white p-5 shadow-sm")}>
      {!compact && (
        <div className="mb-3 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-blue-600" />
          <h3 className="font-display text-sm font-bold text-slate-800">Demo Simulation</h3>
          {active.length > 0 && (
            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
              {active.length} active
            </span>
          )}
        </div>
      )}
      {!compact && (
        <p className="mb-4 text-xs text-slate-500">
          Trigger a scenario to see inventory, forecasts, risk scores and alerts update live across the platform.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="open-simulation-btn" className="bg-blue-600 hover:bg-blue-700">
              <Zap className="mr-1.5 h-3.5 w-3.5" /> Run Scenario
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Run Demo Simulation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Scenario</label>
                <Select value={scenario} onValueChange={setScenario}>
                  <SelectTrigger data-testid="sim-scenario-select" className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {scenarios.map((s) => <SelectItem key={s.scenario} value={s.scenario}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Scope</label>
                <Select value={scope || "national"} onValueChange={(v) => setScope(v === "national" ? "" : v)}>
                  <SelectTrigger data-testid="sim-scope-select" className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64 bg-white">
                    <SelectItem value="national">National (all states)</SelectItem>
                    {states.map((s) => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Intensity: <span className="font-mono text-blue-700">{magnitude[0].toFixed(1)}x</span>
                </label>
                <Slider value={magnitude} onValueChange={setMagnitude} min={0.5} max={2} step={0.1} data-testid="sim-magnitude-slider" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={run} data-testid="run-simulation-btn" className="bg-blue-600 hover:bg-blue-700">
                <Play className="mr-1.5 h-3.5 w-3.5" /> Activate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {active.length > 0 && (
          <Button size="sm" variant="outline" onClick={clear} data-testid="clear-simulation-btn"
            className="border-red-200 text-red-600 hover:bg-red-50">
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear ({active.length})
          </Button>
        )}
      </div>

      {!compact && active.length > 0 && (
        <div className="mt-4 space-y-2">
          {active.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs">
              <span className="font-semibold text-amber-800">{s.label}</span>
              <span className="text-amber-600">{s.scope_label} · {s.magnitude}x</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
