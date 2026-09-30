import { ArrowDown, Factory, Warehouse, Building2, Cross, User, Truck, Clock, TrendingUp } from "lucide-react";
import { useApi } from "../lib/api";
import { useApp } from "../context/AppContext";
import { PageHeader, Section } from "../components/common/PageHeader";
import { CardSkeleton, TableSkeleton, ErrorState } from "../components/common/Loaders";
import { StatusBadge } from "../components/common/StatusBadge";
import { compact, num } from "../lib/format";
import { cn } from "../lib/utils";

const STAGE_ICON = {
  "Manufacturer": Factory, "Central Warehouse": Warehouse, "State Warehouse": Warehouse,
  "District Warehouse": Building2, "PHC": Cross, "Patient": User,
};

export default function SupplyChain() {
  const { stateCode, version } = useApp();
  const { data, loading, error, refetch } = useApi("/supply-chain", { state_code: stateCode || undefined }, [stateCode, version]);

  return (
    <div className="animate-fadeup">
      <PageHeader title="Supply Chain & Logistics"
        subtitle="End-to-end medicine flow from manufacturer to patient, with live shipment tracking and supplier performance." />

      {loading && <div className="space-y-6"><CardSkeleton rows={4} /><CardSkeleton rows={6} /></div>}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric icon={Truck} label="Incoming Shipments" value={num(data.incoming_count)} />
            <Metric icon={Clock} label="Avg Delivery Time" value={`${data.avg_delivery_days} days`} />
            <Metric icon={TrendingUp} label="Supply Stages" value={data.stages.length} />
            <Metric icon={Warehouse} label="Active Suppliers" value={data.suppliers.length} />
          </div>

          <Section title="Distribution Flow" description="Manufacturer → Central → State → District → PHC → Patient" className="mb-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
              {data.stages.map((s, i) => {
                const Icon = STAGE_ICON[s.stage] || Warehouse;
                return (
                  <div key={s.stage} className="flex flex-1 items-center gap-3 lg:flex-col lg:items-stretch">
                    <div className={cn("flex-1 rounded-xl border p-4 text-center",
                      s.status === "warning" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50")}>
                      <Icon className={cn("mx-auto h-6 w-6", s.status === "warning" ? "text-amber-600" : "text-blue-600")} />
                      <p className="mt-2 text-xs font-semibold text-slate-700">{s.stage}</p>
                      {s.inventory > 0 && <p className="mt-1 font-mono text-sm font-bold text-slate-800">{compact(s.inventory)}</p>}
                      <p className="text-[10px] text-slate-400">{compact(s.throughput)}/day flow</p>
                    </div>
                    {i < data.stages.length - 1 && (
                      <ArrowDown className="h-5 w-5 shrink-0 text-slate-300 lg:rotate-[-90deg]" style={{ transform: "rotate(0deg)" }} />
                    )}
                  </div>
                );
              })}
            </div>
            {data.bottlenecks?.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-3">
                {data.bottlenecks.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                    <span className="font-bold text-amber-800">Bottleneck · {b.stage}:</span>
                    <span className="text-amber-700">{b.issue}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Section title="Supply Chain Status" description="Highest-risk medicine lines with incoming replenishment">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="pb-2 pr-3 font-semibold">Medicine</th>
                        <th className="pb-2 pr-3 font-semibold">PHC</th>
                        <th className="pb-2 pr-3 text-right font-semibold">Stock</th>
                        <th className="pb-2 pr-3 text-right font-semibold">Daily Use</th>
                        <th className="pb-2 pr-3 text-right font-semibold">Days Left</th>
                        <th className="pb-2 pr-3 font-semibold">Risk</th>
                        <th className="pb-2 font-semibold">Incoming</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.table.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50" data-testid={`supply-row-${i}`}>
                          <td className="py-2.5 pr-3 font-medium text-slate-700">{r.medicine}</td>
                          <td className="py-2.5 pr-3 text-slate-500">{r.phc}</td>
                          <td className="py-2.5 pr-3 text-right font-mono text-slate-700">{num(r.current_stock)}</td>
                          <td className="py-2.5 pr-3 text-right font-mono text-slate-500">{num(r.daily_consumption)}</td>
                          <td className="py-2.5 pr-3 text-right font-mono font-semibold text-slate-800">{r.days_remaining}</td>
                          <td className="py-2.5 pr-3"><StatusBadge band={r.risk_band} /></td>
                          <td className="py-2.5 text-xs text-slate-500">{r.incoming_shipment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>

            <div className="space-y-6">
              <Section title="Supplier Performance">
                <div className="space-y-3">
                  {data.suppliers.map((s) => (
                    <div key={s.name} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">{s.name}</p>
                        <StatusBadge band={s.on_time_rate >= 0.9 ? "healthy" : s.on_time_rate >= 0.8 ? "warning" : "critical"}
                          label={`${Math.round(s.on_time_rate * 100)}% on-time`} />
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                        <span>Lead: <b className="text-slate-700">{s.avg_lead_days}d</b></span>
                        <span>Fulfil: <b className="text-slate-700">{Math.round(s.fulfilment_rate * 100)}%</b></span>
                        <span>Orders: <b className="text-slate-700">{s.active_orders}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          </div>

          <Section title="Incoming Shipments" className="mt-6" description={`${data.shipments.length} shipments in transit / dispatched`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.shipments.map((s) => (
                <div key={s.id} className="rounded-lg border border-slate-100 p-3" data-testid="shipment-card">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-semibold text-slate-700">{s.medicine}</p>
                    <StatusBadge band={s.status === "In Transit" ? "warning" : "healthy"} label={s.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{s.phc}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{s.origin}</span>
                    <span className="font-mono font-semibold text-slate-700">{num(s.quantity)} · ETA {s.eta_days}d</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} /></span>
      <div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p><p className="font-mono text-lg font-bold text-slate-800">{value}</p></div>
    </div>
  );
}
