import { useState, useEffect } from "react";
import { TrendingUp, Info } from "lucide-react";
import { useApi } from "../lib/api";
import { useApp } from "../context/AppContext";
import { PageHeader, Section, AiTag } from "../components/common/PageHeader";
import { CardSkeleton, ErrorState } from "../components/common/Loaders";
import { ForecastArea } from "../components/charts/Charts";
import { compact, num } from "../lib/format";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { cn } from "../lib/utils";

const HORIZONS = [7, 14, 30, 90];

export default function DemandForecast() {
  const { states, stateCode, version } = useApp();
  const { data: meds } = useApi("/medicines");
  const [medicine, setMedicine] = useState("");
  const [scope, setScope] = useState(stateCode || "");
  const [horizon, setHorizon] = useState(30);

  useEffect(() => { if (meds?.medicines?.length && !medicine) setMedicine(meds.medicines[0].id); }, [meds, medicine]);
  useEffect(() => { setScope(stateCode || ""); }, [stateCode]);

  const params = medicine ? { medicine_id: medicine, state_code: scope || undefined, horizon } : null;
  const { data, loading, error, refetch } = useApi(medicine ? "/forecast" : null, params, [medicine, scope, horizon, version]);

  const chartData = data ? [
    ...data.history.map((h) => ({ date: h.date, history: h.value })),
    ...data.predicted.map((p) => ({ date: p.date, predicted: p.value, lower: p.lower, upper: p.upper })),
  ] : [];

  return (
    <div className="animate-fadeup">
      <PageHeader title="AI Demand Forecasting" badge={<AiTag />}
        subtitle="Forecasts consider historical consumption, patient footfall, seasonal & disease patterns, capacity, inventory and emergency indicators." />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Field label="Medicine">
          <Select value={medicine} onValueChange={setMedicine}>
            <SelectTrigger data-testid="forecast-medicine-select" className="w-56 bg-white"><SelectValue placeholder="Select medicine" /></SelectTrigger>
            <SelectContent className="max-h-72 bg-white">
              {meds?.medicines?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Region">
          <Select value={scope || "national"} onValueChange={(v) => setScope(v === "national" ? "" : v)}>
            <SelectTrigger data-testid="forecast-region-select" className="w-48 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72 bg-white">
              <SelectItem value="national">National</SelectItem>
              {states.map((s) => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Forecast Horizon">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            {HORIZONS.map((h) => (
              <button key={h} onClick={() => setHorizon(h)} data-testid={`horizon-${h}`}
                className={cn("rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                  horizon === h ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100")}>
                {h}d
              </button>
            ))}
          </div>
        </Field>
      </div>

      {loading && <CardSkeleton rows={8} />}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {data && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
          <div className="xl:col-span-3">
            <Section title={`${data.medicine} — Demand Forecast`} description={`${horizon}-day horizon · category: ${data.category}`}>
              <ForecastArea data={chartData} />
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {data.note}
              </div>
            </Section>
          </div>
          <div className="space-y-4">
            <StatCard label="Current daily demand" value={`${compact(data.current_daily_demand)} ${data.unit}`} />
            <StatCard label="Predicted daily demand" value={`${compact(data.predicted_daily_demand)} ${data.unit}`} accent />
            <StatCard label="Forecast confidence" value={`${Math.round(data.confidence * 100)}%`} />
            <StatCard label="Expected change" value={`${data.expected_increase_pct > 0 ? "+" : ""}${data.expected_increase_pct}%`}
              tone={data.expected_increase_pct > 0 ? "up" : "down"} />
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Peak predicted demand</p>
              <p className="mt-1 font-mono text-2xl font-black text-slate-900">{compact(data.peak_predicted_demand)}</p>
              <p className="text-xs text-slate-400">{data.unit} / day at horizon end</p>
              {data.seasonal && <p className="mt-2 text-xs text-amber-600">Seasonal demand sensitivity detected</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>{children}</div>;
}

function StatCard({ label, value, accent, tone }) {
  return (
    <div className={cn("rounded-xl border p-4", accent ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white")}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl font-black", tone === "up" ? "text-emerald-600" : tone === "down" ? "text-red-600" : "text-slate-900")}>{value}</p>
    </div>
  );
}
