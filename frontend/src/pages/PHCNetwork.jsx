import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronRight, Users, BedDouble } from "lucide-react";
import { useApi } from "../lib/api";
import { useApp } from "../context/AppContext";
import { PageHeader, Section } from "../components/common/PageHeader";
import { TableSkeleton, EmptyState, ErrorState } from "../components/common/Loaders";
import { StatusBadge } from "../components/common/StatusBadge";
import { num } from "../lib/format";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

export default function PHCNetwork() {
  const { states, stateCode, version } = useApp();
  const navigate = useNavigate();
  const [localState, setLocalState] = useState(stateCode || "");
  const [district, setDistrict] = useState("");
  const [risk, setRisk] = useState("");
  const [sort, setSort] = useState("risk");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data: districts } = useApi("/districts", { state_code: localState || undefined }, [localState]);
  const params = {
    state_code: localState || undefined, district_id: district || undefined,
    risk: risk || undefined, sort, q: q || undefined, page, limit: 15,
  };
  const { data, loading, error, refetch } = useApi("/phcs", params, [JSON.stringify(params), version]);
  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="animate-fadeup">
      <PageHeader title="PHC Network Directory"
        subtitle="Searchable directory of every Primary Health Centre with live medicine, bed, personnel and risk status." />

      <Section
        title={data ? `${num(data.total)} facilities` : "Facilities"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input data-testid="phc-search-input" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search PHC / ID"
              className="w-44 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            <Sel testid="phc-state-filter" value={localState} onChange={(v) => { setLocalState(v); setDistrict(""); setPage(1); }} ph="All States"
              opts={[["", "All States"], ...states.map((s) => [s.code, s.name])]} />
            <Sel testid="phc-district-filter" value={district} onChange={(v) => { setDistrict(v); setPage(1); }} ph="All Districts"
              opts={[["", "All Districts"], ...((districts?.districts || []).map((d) => [d.id, d.name]))]} />
            <Sel testid="phc-risk-filter" value={risk} onChange={(v) => { setRisk(v); setPage(1); }} ph="All Risk"
              opts={[["", "All Risk"], ["critical", "Critical"], ["high", "High"], ["moderate", "Moderate"], ["low", "Low"]]} />
            <Sel testid="phc-sort" value={sort} onChange={setSort} ph="Sort"
              opts={[["risk", "Sort: Risk"], ["name", "Sort: Name"], ["availability", "Sort: Availability"], ["attendance", "Sort: Attendance"]]} />
          </div>
        }
      >
        {loading && <TableSkeleton rows={10} />}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {data && data.phcs.length === 0 && <EmptyState icon={Building2} title="No PHCs found" description="Adjust filters or search." testid="phc-empty" />}
        {data && data.phcs.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    {["PHC", "District", "State", "Population", "Med. Avail.", "Beds", "Occ.", "Staff", "Attend.", "Risk", "Last Sync", ""].map((h, i) => (
                      <th key={i} className="pb-2 pr-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.phcs.map((p, i) => (
                    <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/phc/${p.id}`)} data-testid={`phc-row-${i}`}>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-slate-700">{p.name}</p>
                        <p className="font-mono text-[10px] text-slate-400">{p.code}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500">{p.district}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{p.state}</td>
                      <td className="py-2.5 pr-3 font-mono text-slate-600">{num(p.population_served)}</td>
                      <td className="py-2.5 pr-3 font-mono text-slate-700">{p.medicine_availability}%</td>
                      <td className="py-2.5 pr-3 font-mono text-slate-600">{p.beds_available}/{p.beds_total}</td>
                      <td className="py-2.5 pr-3 font-mono text-slate-600">{p.occupancy}%</td>
                      <td className="py-2.5 pr-3 font-mono text-slate-600">{p.staff_total}</td>
                      <td className="py-2.5 pr-3 font-mono text-slate-600">{p.attendance}%</td>
                      <td className="py-2.5 pr-3"><StatusBadge band={p.risk_band} label={`${p.risk_score}`} /></td>
                      <td className="py-2.5 pr-3 text-xs text-slate-400">{p.last_sync}</td>
                      <td className="py-2.5"><ChevronRight className="h-4 w-4 text-slate-300" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-slate-500">Showing {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} of {num(data.total)}</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="phc-prev">Previous</Button>
                <span className="text-xs font-medium text-slate-600">Page {page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} data-testid="phc-next">Next</Button>
              </div>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}

function Sel({ value, onChange, opts, ph, testid }) {
  return (
    <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
      <SelectTrigger data-testid={testid} className="h-9 w-40 bg-white text-sm"><SelectValue placeholder={ph} /></SelectTrigger>
      <SelectContent className="max-h-64 bg-white">
        {opts.map(([v, l]) => <SelectItem key={v || "__all"} value={v || "__all"}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
