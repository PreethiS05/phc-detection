import { useState } from "react";
import { useApi } from "../lib/api";
import { useApp } from "../context/AppContext";
import { PageHeader, Section } from "../components/common/PageHeader";
import { CardSkeleton, ErrorState } from "../components/common/Loaders";
import { TrendLine, AreaTrend, Bars } from "../components/charts/Charts";
import { riskStyle } from "../lib/format";
import { cn } from "../lib/utils";

const RANGES = [7, 30, 90];

export default function Analytics() {
  const { version } = useApp();
  const [range, setRange] = useState(30);
  const { data, loading, error, refetch } = useApi("/analytics", { range_days: range }, [range, version]);

  return (
    <div className="animate-fadeup">
      <PageHeader title="Analytics & Heatmaps"
        subtitle="Cross-state comparison, consumption, utilisation, forecast accuracy and supply performance."
        actions={
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setRange(r)} data-testid={`range-${r}`}
                className={cn("rounded-md px-3 py-1.5 text-sm font-semibold", range === r ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100")}>
                {r}d
              </button>
            ))}
          </div>
        } />

      {loading && <div className="grid gap-6 lg:grid-cols-2"><CardSkeleton rows={6} /><CardSkeleton rows={6} /></div>}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title="Patient Footfall Trend"><AreaTrend data={data.patient_footfall} name="Patients/day" height={220} /></Section>
            <Section title="Bed Occupancy Trend"><TrendLine data={data.bed_occupancy} lines={[{ key: "value", name: "Occupancy %", color: "#EF4444" }]} height={220} /></Section>
            <Section title="Resource Utilisation"><TrendLine data={data.resource_utilisation} lines={[{ key: "value", name: "Utilisation %", color: "#1E40AF" }]} height={220} /></Section>
            <Section title="Personnel Attendance"><TrendLine data={data.personnel_attendance} lines={[{ key: "value", name: "Attendance %", color: "#10B981" }]} height={220} /></Section>
            <Section title="Supply Lead Time (days)"><AreaTrend data={data.supply_lead_time} name="Lead days" color="#F59E0B" height={220} /></Section>
            <Section title="Forecast Accuracy"><TrendLine data={data.forecast_accuracy} lines={[{ key: "value", name: "Accuracy %", color: "#8B5CF6" }]} height={220} /></Section>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title="Top Medicine Consumption">
              <Bars data={data.medicine_consumption} xKey="medicine" layout="vertical" bars={[{ key: "consumption", name: "Daily consumption", color: "#1E40AF" }]} height={340} />
            </Section>
            <Section title="Stock-Out Frequency by State">
              <Bars data={data.stockout_frequency} xKey="state" layout="vertical" bars={[{ key: "count", name: "Critical lines", color: "#EF4444" }]} height={340} />
            </Section>
          </div>

          <Section title="State Comparison Heatmap" description="Availability, average risk and critical stock-outs by state" className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-3 font-semibold">State</th>
                    <th className="pb-2 pr-3 font-semibold">Availability</th>
                    <th className="pb-2 pr-3 font-semibold">Avg Risk</th>
                    <th className="pb-2 font-semibold">Critical Stock-Outs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.heatmap.map((h) => {
                    const availTone = h.availability >= 90 ? "low" : h.availability >= 80 ? "moderate" : "critical";
                    const riskTone = h.risk >= 61 ? "critical" : h.risk >= 31 ? "moderate" : "low";
                    return (
                      <tr key={h.state}>
                        <td className="py-2 pr-3 font-medium text-slate-700">{h.state}</td>
                        <td className="py-2 pr-3"><HeatCell value={`${h.availability}%`} band={availTone} /></td>
                        <td className="py-2 pr-3"><HeatCell value={h.risk} band={riskTone} /></td>
                        <td className="py-2"><HeatCell value={h.stockouts} band={h.stockouts > 20 ? "critical" : h.stockouts > 8 ? "moderate" : "low"} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function HeatCell({ value, band }) {
  const s = riskStyle(band);
  return <span className={cn("inline-block min-w-[54px] rounded-md px-2.5 py-1 text-center font-mono text-xs font-semibold", s.bg, s.text)}>{value}</span>;
}
