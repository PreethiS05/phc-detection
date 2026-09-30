import { useNavigate, useParams } from "react-router-dom";
import { ChevronRight, MapPin, Users, BedDouble, Pill, Activity, ArrowLeft, Lightbulb } from "lucide-react";
import { useApi } from "../lib/api";
import { useApp } from "../context/AppContext";
import { CardSkeleton, ErrorState } from "../components/common/Loaders";
import { StatusBadge } from "../components/common/StatusBadge";
import { Section, AiTag } from "../components/common/PageHeader";
import { AreaTrend, TrendLine } from "../components/charts/Charts";
import { num } from "../lib/format";

export default function PHCDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { version } = useApp();
  const { data, loading, error, refetch } = useApi(`/phcs/${id}`, null, [id, version]);

  if (loading) return <div className="animate-fadeup space-y-6"><CardSkeleton rows={2} /><div className="grid gap-4 sm:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <CardSkeleton key={i} rows={1} />)}</div></div>;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const k = data.kpis;
  const kpis = [
    { label: "Patients Today", value: num(k.patients_today), icon: Users },
    { label: "Beds Available", value: `${k.beds_available}/${k.beds_total}`, icon: BedDouble },
    { label: "Medicine Availability", value: `${k.medicine_availability}%`, icon: Pill },
    { label: "Staff Attendance", value: `${k.staff_attendance}%`, icon: Users },
    { label: "Resource Utilisation", value: `${k.resource_utilisation}%`, icon: Activity },
  ];

  return (
    <div className="animate-fadeup">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-slate-500">
        <button onClick={() => navigate("/overview")} className="hover:text-blue-600">Command Centre</button>
        <ChevronRight className="h-3 w-3" />
        <button onClick={() => navigate("/phc-network")} className="hover:text-blue-600">PHC Network</button>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-slate-700">{data.name}</span>
      </nav>

      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end">
        <div>
          <button onClick={() => navigate("/phc-network")} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to directory
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{data.name}</h1>
            <StatusBadge band={data.risk_band} label={`Risk ${data.risk_score}`} pulse={data.risk_band === "critical"} />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-3.5 w-3.5" /> {data.district}, {data.state} · <span className="font-mono">{data.code}</span> · Pop. {num(data.population_served)}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kp) => {
          const Icon = kp.icon;
          return (
            <div key={kp.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <Icon className="h-4 w-4 text-blue-600" />
              <p className="mt-2 font-mono text-xl font-black text-slate-900">{kp.value}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{kp.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Patient Footfall (14d)"><AreaTrend data={data.charts.footfall} name="Patients" height={200} /></Section>
        <Section title="Medicine Consumption (14d)"><AreaTrend data={data.charts.consumption} name="Units" color="#F59E0B" height={200} /></Section>
        <Section title="Bed Occupancy (14d)"><TrendLine data={data.charts.occupancy} lines={[{ key: "value", name: "Occupancy %", color: "#EF4444" }]} height={200} /></Section>
        <Section title="Staff Attendance (14d)"><TrendLine data={data.charts.attendance} lines={[{ key: "value", name: "Attendance %", color: "#10B981" }]} height={200} /></Section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Section title="Inventory">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-3 font-semibold">Medicine</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Stock</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Daily Usage</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Days Remaining</th>
                    <th className="pb-2 font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.inventory.map((l, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-medium text-slate-700">{l.medicine}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-700">{num(l.stock)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-500">{num(l.daily_usage)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono font-semibold text-slate-800">{l.days_remaining}</td>
                      <td className="py-2.5"><StatusBadge band={l.risk_band} label={`${l.risk_score}`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <Section title="AI Recommendations" description="Simulated" actions={<AiTag />}>
          <div className="space-y-3">
            {data.recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">{r.type}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
