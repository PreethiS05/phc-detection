import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, MapPin, AlertTriangle, Building2, Boxes, X } from "lucide-react";
import { useApi } from "../lib/api";
import { useApp } from "../context/AppContext";
import { PageHeader } from "../components/common/PageHeader";
import { KpiCard } from "../components/common/KpiCard";
import { KpiSkeletonGrid, CardSkeleton, ErrorState } from "../components/common/Loaders";
import { StatusBadge } from "../components/common/StatusBadge";
import { SimulationControl } from "../components/common/SimulationControl";
import { IndiaMap } from "../components/IndiaMap";
import { compact, num, fmtTime, riskStyle } from "../lib/format";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";

const METRICS = [
  { key: "risk", label: "Stock-Out Risk" },
  { key: "availability", label: "Medicine Availability" },
  { key: "beds", label: "Bed Occupancy" },
  { key: "footfall", label: "Patient Footfall" },
  { key: "personnel", label: "Personnel Availability" },
  { key: "utilisation", label: "Resource Utilisation" },
  { key: "emergency", label: "Emergency Pressure" },
];

export default function Overview() {
  const { version, bump } = useApp();
  const navigate = useNavigate();
  const [metric, setMetric] = useState("risk");
  const [selected, setSelected] = useState(null);

  const { data, loading, error, refetch } = useApi("/dashboard", null, [version]);
  const { data: statesData } = useApi("/states", { metric }, [version]);
  const { data: detail } = useApi(selected ? `/states/${selected.code}` : null, null, [selected?.code, version]);

  const points = (statesData?.states || []).map((s) => ({
    id: s.code, name: s.name, lat: s.lat, lng: s.lng,
    severity: s.severity, metric_value: s.metric_value, phc_count: s.phc_count,
  }));
  const metricLabel = METRICS.find((m) => m.key === metric)?.label;

  return (
    <div className="animate-fadeup">
      <PageHeader
        title="National Health Resource Command Centre"
        subtitle={data ? `Last updated ${fmtTime(data.last_updated)} · Real-time federated view across the PHC network` : "Loading national dashboard…"}
        badge={data && <StatusBadge band={data.system_health_status} label={`System Health ${data.system_health}%`} pulse testid="system-health-badge" />}
        actions={<SimulationControl compact />}
      />

      {data && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat icon={MapPin} label="States Connected" value={data.states_connected} />
          <MiniStat icon={Building2} label="Districts Monitored" value={data.districts_monitored} />
          <MiniStat icon={Boxes} label="PHCs Monitored" value={num(data.phcs_monitored)} />
          <MiniStat icon={Activity} label="Overall System Health" value={`${data.system_health}%`} status={data.system_health_status} />
        </div>
      )}

      {loading && <KpiSkeletonGrid />}
      {error && <ErrorState message={error} onRetry={refetch} testid="overview-error" />}

      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {data.kpis.map((k) => (
            <KpiCard key={k.key} kpi={k} testid={`kpi-${k.key}`}
              onClick={() => navigate(k.key === "critical_stockout_phcs" ? "/early-warnings" : "/analytics")} />
          ))}
        </div>
      )}

      {/* Map + drilldown */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-800">India Health Resource Map</h2>
                <p className="text-xs text-slate-500">Click a state to drill into districts & PHCs</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={metric} onValueChange={setMetric}>
                  <SelectTrigger data-testid="map-metric-select" className="w-52 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-4">
              <IndiaMap points={points} valueLabel={metricLabel} onSelect={setSelected} height={480} />
              <div className="mt-3 flex flex-wrap items-center gap-4 px-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-600">Severity:</span>
                {[["low", "Normal"], ["moderate", "Warning"], ["high", "Elevated"], ["critical", "Critical"]].map(([b, l]) => (
                  <span key={b} className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${riskStyle(b).dot}`} /> {l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: state panel or top risks */}
        <div className="space-y-6">
          {selected && detail ? (
            <StatePanel detail={detail} onClose={() => setSelected(null)} onView={() => navigate(`/phc-network`)} />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-display text-sm font-bold text-slate-800">Highest-Risk States</h3>
              <p className="mb-3 text-xs text-slate-500">Ranked by average stock-out risk score</p>
              <div className="space-y-2">
                {(data?.top_risk_states || []).map((s, i) => (
                  <button key={s.state} onClick={() => { const p = points.find((x) => x.name === s.state); if (p) setSelected(p); }}
                    data-testid={`top-risk-state-${i}`}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-left hover:border-blue-200 hover:bg-blue-50/40">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[11px] font-bold text-slate-500">{i + 1}</span>
                      {s.state}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{s.critical_lines} crit</span>
                      <StatusBadge band={s.avg_risk >= 61 ? "high" : s.avg_risk >= 31 ? "moderate" : "low"} label={`${s.avg_risk}`} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="font-display text-sm font-bold text-slate-800">Recent Critical Alerts</h3>
            </div>
            <div className="space-y-2">
              {(data?.recent_alerts || []).map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{a.medicine}</p>
                    <p className="truncate text-xs text-slate-400">{a.phc}, {a.state}</p>
                  </div>
                  <StatusBadge band={a.band} label={`${a.days_remaining}d`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, status }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
      </span>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="font-mono text-lg font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function StatePanel({ detail, onClose, onView }) {
  const rows = [
    ["Districts monitored", detail.districts_monitored],
    ["PHCs monitored", detail.phcs_monitored],
    ["Medicine availability", `${detail.medicine_availability}%`],
    ["Critical stock-out risks", `${detail.critical_stockout_phcs} PHCs`],
    ["Avg bed occupancy", `${detail.bed_occupancy}%`],
    ["Personnel attendance", `${detail.personnel_attendance}%`],
    ["Patient footfall", compact(detail.patient_footfall) + " / mo"],
    ["Resource utilisation", `${detail.resource_utilisation}%`],
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="state-detail-panel">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600">State Detail</p>
          <h3 className="font-display text-lg font-bold text-slate-800">{detail.name}</h3>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" data-testid="close-state-panel"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-5">
        {rows.map(([k, v]) => (
          <div key={k}>
            <p className="text-[11px] text-slate-400">{k}</p>
            <p className="font-mono text-sm font-bold text-slate-800">{v}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 px-5 py-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Demand Forecast (AI · Simulated)</p>
        <p className="text-sm text-slate-600">
          {detail.demand_forecast.medicine}: <b className="font-mono">{compact(detail.demand_forecast.predicted_daily)}</b>/day predicted
          <span className="ml-1 text-emerald-600">(+{detail.demand_forecast.expected_increase_pct}%)</span>
          <span className="ml-1 text-slate-400">· {Math.round(detail.demand_forecast.confidence * 100)}% conf.</span>
        </p>
      </div>
      {detail.recent_alerts?.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Recent Alerts</p>
          <div className="space-y-1.5">
            {detail.recent_alerts.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="truncate text-slate-600">{a.medicine} · {a.phc}</span>
                <StatusBadge band={a.band} label={`${a.risk_score}`} />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="px-5 pb-5">
        <button onClick={onView} data-testid="view-phcs-btn"
          className="w-full rounded-lg bg-[#0B192C] py-2.5 text-sm font-semibold text-white hover:bg-[#12233B]">
          View PHCs in this state
        </button>
      </div>
    </div>
  );
}
