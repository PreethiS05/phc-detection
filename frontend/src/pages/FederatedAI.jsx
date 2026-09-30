import { toast } from "sonner";
import { Cpu, Play, ShieldCheck, Database, GitBranch, Activity } from "lucide-react";
import { useApi, post } from "../lib/api";
import { useApp } from "../context/AppContext";
import { PageHeader, Section, AiTag } from "../components/common/PageHeader";
import { CardSkeleton, ErrorState } from "../components/common/Loaders";
import { StatusBadge } from "../components/common/StatusBadge";
import { TrendLine } from "../components/charts/Charts";
import { compact, num, timeAgo } from "../lib/format";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

const NODE_STATUS = { active: "healthy", training: "warning", idle: "moderate" };

export default function FederatedAI() {
  const { version, bump } = useApp();
  const { data, loading, error, refetch } = useApi("/federated-model", null, [version]);

  const runTraining = async () => {
    const res = await post("/federated-training");
    toast.success(res.message);
    refetch();
    bump();
  };

  if (loading) return <CardSkeleton rows={8} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const m = data.model;

  return (
    <div className="animate-fadeup">
      <PageHeader title="Federated AI Centre" badge={<AiTag />}
        subtitle="States collaboratively train predictive models without transferring raw patient or operational data."
        actions={<Button onClick={runTraining} data-testid="run-training-btn" className="bg-blue-600 hover:bg-blue-700"><Play className="mr-1.5 h-3.5 w-3.5" /> Run Training Round</Button>} />

      {/* Concept flow */}
      <Section title="How Federated Learning Works Here" className="mb-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          {["State Data", "Local AI Training", "Model Update", "Secure Aggregation", "National Model", "Updated Local Models"].map((s, i, arr) => (
            <div key={s} className="flex items-center gap-2 lg:flex-1 lg:flex-col">
              <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs font-semibold text-slate-700 lg:w-full">{s}</div>
              {i < arr.length - 1 && <span className="text-slate-300 lg:rotate-90">→</span>}
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {data.privacy_note}
        </div>
      </Section>

      {/* Training panel + convergence */}
      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Section title="Federated Training" className="xl:col-span-1">
          <div className="space-y-3">
            {[["Current Model", `${m.name} ${m.version}`], ["Training Round", m.round],
            ["Participating States", m.participating_states], ["Aggregation Status", m.aggregation_status],
            ["Global Accuracy", `${(m.global_accuracy * 100).toFixed(1)}%`], ["Last Training", timeAgo(m.last_training)]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
                <span className="text-xs text-slate-500">{k}</span>
                <span className="font-mono text-sm font-semibold text-slate-800">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Mini icon={Activity} label="Active Nodes" value={data.active_nodes} />
            <Mini icon={Database} label="Data Volume" value={compact(data.total_data_volume)} />
          </div>
        </Section>

        <Section title="Model Convergence" description="Global accuracy across training rounds" className="xl:col-span-2">
          <TrendLine data={data.convergence} xKey="round" lines={[{ key: "accuracy", name: "Global accuracy", color: "#1E40AF" }]} height={260} />
        </Section>
      </div>

      {/* Network graph (radial) */}
      <Section title="State Node Network" description={`${data.nodes.length} nodes connected to the central aggregation layer`} className="mb-6">
        <NetworkGraph nodes={data.nodes} />
      </Section>

      {/* Node grid */}
      <Section title="Participating State Nodes">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.nodes.map((n) => (
            <div key={n.id} className="rounded-lg border border-slate-100 p-3" data-testid={`node-${n.state_code}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">{n.state}</p>
                <StatusBadge band={NODE_STATUS[n.status] || "moderate"} label={n.status} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <span>Accuracy: <b className="font-mono text-slate-700">{(n.accuracy * 100).toFixed(1)}%</b></span>
                <span>Model: <b className="font-mono text-slate-700">{n.model_version}</b></span>
                <span>Data: <b className="font-mono text-slate-700">{compact(n.data_volume)}</b></span>
                <span>Updated: <b className="text-slate-700">{n.last_update_min}m ago</b></span>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Mini({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <Icon className="h-4 w-4 text-blue-600" />
      <p className="mt-1 font-mono text-lg font-bold text-slate-800">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function NetworkGraph({ nodes }) {
  const shown = nodes.slice(0, 24);
  const cx = 300, cy = 190, R = 150;
  const COLOR = { active: "#10B981", training: "#F59E0B", idle: "#94A3B8" };
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 600 380" className="mx-auto w-full max-w-3xl">
        {shown.map((n, i) => {
          const a = (i / shown.length) * 2 * Math.PI;
          const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
          return <line key={`l${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke="#E2E8F0" strokeWidth="1" />;
        })}
        {shown.map((n, i) => {
          const a = (i / shown.length) * 2 * Math.PI;
          const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
          return (
            <g key={n.id}>
              <circle cx={x} cy={y} r="8" fill={COLOR[n.status] || "#94A3B8"} opacity="0.9" />
              <text x={x} y={y - 12} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 9 }}>{n.state_code}</text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="34" fill="#0B192C" />
        <text x={cx} y={cy - 2} textAnchor="middle" className="fill-white" style={{ fontSize: 11, fontWeight: 700 }}>National</text>
        <text x={cx} y={cy + 11} textAnchor="middle" className="fill-blue-300" style={{ fontSize: 9 }}>Aggregator</text>
      </svg>
      <div className="flex justify-center gap-4 text-xs text-slate-500">
        {Object.entries(COLOR).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1.5 capitalize"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{k}</span>
        ))}
      </div>
    </div>
  );
}
