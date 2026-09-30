import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, MapPin, Clock, IndianRupee, ShieldCheck, TrendingDown, Check, X } from "lucide-react";
import { useApi, post } from "../lib/api";
import { useApp } from "../context/AppContext";
import { PageHeader, AiTag } from "../components/common/PageHeader";
import { CardSkeleton, EmptyState, ErrorState } from "../components/common/Loaders";
import { StatusBadge } from "../components/common/StatusBadge";
import { num } from "../lib/format";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "../components/ui/dialog";

export default function ResourceAllocation() {
  const { version, bump } = useApp();
  const { data, loading, error, refetch } = useApi("/resource-recommendations", null, [version]);
  const [confirm, setConfirm] = useState(null);
  const [done, setDone] = useState({});

  const act = async (rec, action) => {
    try {
      const res = await post("/resource-transfer", {
        recommendation_id: rec.id, source_phc_id: rec.source_phc_id, dest_phc_id: rec.dest_phc_id,
        medicine_id: rec.medicine_id, quantity: rec.recommended_quantity, action,
      });
      toast.success(res.message);
      setDone((d) => ({ ...d, [rec.id]: action }));
      setConfirm(null);
      if (action === "approve") bump();
    } catch {
      toast.error("Action failed");
    }
  };

  return (
    <div className="animate-fadeup">
      <PageHeader title="AI Resource Redistribution" badge={<AiTag />}
        subtitle="Recommended inter-district transfers to prevent projected stock-outs. Approving updates the simulated inventory." />

      {loading && <div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {data && data.recommendations.length === 0 && <EmptyState icon={ShieldCheck} title="No redistribution needed" description="All monitored PHCs are within healthy thresholds." testid="reco-empty" />}

      {data && data.recommendations.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.recommendations.map((r, i) => {
            const status = done[r.id];
            return (
              <div key={r.id} data-testid={`reco-card-${i}`}
                className={cn("rounded-xl border bg-white p-5 shadow-sm", status === "approved" ? "border-emerald-300" : status === "rejected" ? "border-slate-200 opacity-60" : "border-slate-200")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-bold text-slate-800">{r.medicine}</span>
                    <StatusBadge band="high" label={`Risk ${r.dest_risk_score}`} />
                  </div>
                  {status && <StatusBadge band={status === "approved" ? "healthy" : "moderate"} label={status === "approved" ? "Approved" : "Rejected"} />}
                </div>

                {/* Visual flow */}
                <div className="mt-4 flex items-center gap-3">
                  <Node title={r.source_district} sub={`Surplus: ${num(r.source_available_surplus)} ${r.unit}`} tone="source" />
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-sm font-bold text-blue-700">{num(r.recommended_quantity)}</span>
                    <ArrowRight className="h-5 w-5 text-blue-500" />
                    <span className="text-[10px] text-slate-400">{r.unit}</span>
                  </div>
                  <Node title={r.dest_district} sub={`Shortage: ${num(r.dest_projected_shortage)} ${r.unit}`} tone="dest" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <Metric icon={MapPin} label="Distance" value={`${num(r.distance_km)} km`} />
                  <Metric icon={Clock} label="Transit" value={`${r.transport_time_hours}h`} />
                  <Metric icon={IndianRupee} label="Est. cost" value={num(r.transport_cost)} />
                  <Metric icon={TrendingDown} label="Risk cut" value={`-${r.risk_reduction}`} />
                </div>

                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <b className="text-slate-700">Why: </b>{r.explanation} <span className="text-emerald-600">{r.expected_impact}.</span>
                </div>

                {!status && (
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" data-testid={`approve-reco-${i}`} onClick={() => setConfirm(r)}>
                      <Check className="mr-1.5 h-3.5 w-3.5" /> Approve Transfer
                    </Button>
                    <Button size="sm" variant="outline" data-testid={`reject-reco-${i}`} onClick={() => act(r, "reject")} className="border-red-200 text-red-600 hover:bg-red-50">
                      <X className="mr-1.5 h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="font-display">Approve resource transfer?</DialogTitle>
            <DialogDescription className="text-slate-500">
              {confirm && <>Allocate <b className="font-mono">{num(confirm.recommended_quantity)} {confirm.unit}</b> of <b>{confirm.medicine}</b> from <b>{confirm.source_district}</b> to <b>{confirm.dest_district}</b>. This updates the simulated inventory and transfer status.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="confirm-transfer-btn" onClick={() => act(confirm, "approve")}>
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Confirm & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Node({ title, sub, tone }) {
  return (
    <div className={cn("flex-1 rounded-lg border p-3 text-center",
      tone === "source" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50")}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{tone === "source" ? "Source" : "Destination"}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{title}</p>
      <p className={cn("text-[11px] font-medium", tone === "source" ? "text-emerald-600" : "text-red-600")}>{sub}</p>
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate-400" />
      <div><p className="text-[10px] text-slate-400">{label}</p><p className="font-mono text-xs font-bold text-slate-700">{value}</p></div>
    </div>
  );
}
