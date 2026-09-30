import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from "recharts";
import { compact } from "../../lib/format";

const AXIS = { fontSize: 11, fill: "#64748B" };
const GRID = { strokeDasharray: "3 3", stroke: "#E2E8F0" };

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-700">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="capitalize">{p.name}:</span>
          <span className="font-mono font-semibold text-slate-800">{compact(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

const shortDate = (d) => (typeof d === "string" && d.length >= 10 ? d.slice(5) : d);

export function TrendLine({ data, xKey = "date", lines, height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} tickFormatter={shortDate} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} minTickGap={24} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compact} width={48} />
        <Tooltip content={<CustomTooltip />} />
        {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {lines.map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color}
            strokeWidth={2.2} dot={false} strokeDasharray={l.dashed ? "5 4" : undefined} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ForecastArea({ data, height = 320 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ciBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="date" tick={AXIS} tickFormatter={shortDate} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} minTickGap={28} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compact} width={48} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="upper" name="Confidence band" stroke="none" fill="url(#ciBand)" />
        <Area type="monotone" dataKey="lower" name=" " stroke="none" fill="#ffffff" fillOpacity={1} />
        <Line type="monotone" dataKey="history" name="Historical demand" stroke="#0B192C" strokeWidth={2.2} dot={false} />
        <Line type="monotone" dataKey="predicted" name="AI predicted demand" stroke="#1E40AF" strokeWidth={2.2} strokeDasharray="5 4" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AreaTrend({ data, dataKey = "value", name = "Value", color = "#1E40AF", height = 260 }) {
  const gid = `area-${dataKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="date" tick={AXIS} tickFormatter={shortDate} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} minTickGap={24} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compact} width={48} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2.2} fill={`url(#${gid})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Bars({ data, xKey, bars, height = 300, layout = "horizontal" }) {
  const vertical = layout === "vertical";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 8, right: 12, left: vertical ? 8 : 0, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={vertical} horizontal={!vertical} />
        {vertical ? (
          <>
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compact} />
            <YAxis type="category" dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} width={130} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compact} width={48} />
          </>
        )}
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F1F5F9" }} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {bars.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            barSize={vertical ? 14 : undefined}>
            {b.colorByRisk && data.map((d, i) => <Cell key={i} fill={d.__color || b.color} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 260, colors }) {
  const palette = colors || ["#1E40AF", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9", "#14B8A6", "#F97316", "#64748B", "#EC4899"];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2}>
          {data.map((d, i) => <Cell key={i} fill={d.color || palette[i % palette.length]} />)}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
