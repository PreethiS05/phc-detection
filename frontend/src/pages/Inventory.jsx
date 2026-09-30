import { useState } from "react";
import { toast } from "sonner";
import { Boxes, Flag, ArrowLeftRight, Eye, Filter } from "lucide-react";
import { useApi, get } from "../lib/api";
import { useApp } from "../context/AppContext";
import { PageHeader, Section } from "../components/common/PageHeader";
import { TableSkeleton, EmptyState, ErrorState } from "../components/common/Loaders";
import { StatusBadge } from "../components/common/StatusBadge";
import { AreaTrend, Bars, Donut } from "../components/charts/Charts";
import { num, fmtDate } from "../lib/format";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";

const RISK_COLORS = { low: "#10B981", moderate: "#F59E0B", high: "#F97316", critical: "#EF4444" };

export default function Inventory() {
  const { stateCode, version, bump } = useApp();
  const [risk, setRisk] = useState("");
  const [category, setCategory] = useState("");
  const [expiry, setExpiry] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);

  const params = {
    state_code: stateCode || undefined, risk: risk || undefined,
    category: category || undefined, expiry_days: expiry || undefined,
    q: q || undefined, page, limit: 12,
  };
  const { data, loading, error, refetch } = useApi("/inventory", params, [JSON.stringify(params), version]);
  const { data: charts } = useApi("/inventory/charts", { state_code: stateCode || undefined }, [stateCode, version]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="animate-fadeup">
      <PageHeader title="Inventory Matrix"
        subtitle="Advanced inventory intelligence across every PHC, batch and medicine with AI risk scoring." />

      {charts && (
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
          <Section title="Inventory Trend" className="xl:col-span-1"><AreaTrend data={charts.trend} dataKey="stock" name="Total stock" height={180} /></Section>
          <Section title="Consumption Trend"><AreaTrend data={charts.consumption} dataKey="consumed" name="Daily consumption" color="#F59E0B" height={180} /></Section>
          <Section title="Expiry Risk"><Bars data={charts.expiry} xKey="bucket" bars={[{ key: "count", name: "Batches", color: "#1E40AF" }]} height={180} /></Section>
          <Section title="Risk Distribution">
            <Donut height={180} data={charts.risk_distribution.map((r) => ({ name: r.band, value: r.count, color: RISK_COLORS[r.band] }))} />
          </Section>
        </div>
      )}

      <Section
        title="Inventory Records"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input data-testid="inventory-search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search medicine/PHC"
              className="w-40 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            <FilterSelect testid="risk-filter" value={risk} onChange={(v) => { setRisk(v); setPage(1); }} placeholder="All Risk"
              options={[["", "All Risk"], ["critical", "Critical"], ["high", "High"], ["moderate", "Moderate"], ["low", "Low"]]} />
            <FilterSelect testid="category-filter" value={category} onChange={(v) => { setCategory(v); setPage(1); }} placeholder="All Categories"
              options={[["", "All Categories"], ...(data?.categories || []).map((c) => [c, c])]} />
            <FilterSelect testid="expiry-filter" value={expiry} onChange={(v) => { setExpiry(v); setPage(1); }} placeholder="Any Expiry"
              options={[["", "Any Expiry"], ["30", "≤ 30 days"], ["90", "≤ 90 days"], ["180", "≤ 180 days"]]} />
          </div>
        }
      >
        {loading && <TableSkeleton />}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {data && data.inventory.length === 0 && <EmptyState icon={Boxes} title="No inventory records" description="Adjust filters to see records." testid="inventory-empty" />}
        {data && data.inventory.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    {["Medicine", "Batch", "PHC", "District", "Stock", "Reorder", "Daily", "Days", "Expiry", "Risk", "Action", ""].map((h, i) => (
                      <th key={i} className={`pb-2 pr-3 font-semibold ${["Stock", "Reorder", "Daily", "Days"].includes(h) ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.inventory.map((l, i) => (
                    <tr key={l.id} className="hover:bg-slate-50" data-testid={`inventory-row-${i}`}>
                      <td className="py-2.5 pr-3 font-medium text-slate-700">{l.medicine}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-slate-400">{l.batch_id}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{l.phc}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{l.district}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-700">{num(l.effective_stock)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-400">{num(l.reorder_level)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-500">{num(l.effective_daily_consumption)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono font-semibold text-slate-800">{l.days_remaining}</td>
                      <td className="py-2.5 pr-3 text-xs text-slate-500">{fmtDate(l.expiry_date)}</td>
                      <td className="py-2.5 pr-3"><StatusBadge band={l.risk_band} label={`${l.risk_score}`} /></td>
                      <td className="py-2.5 pr-3 text-xs text-slate-500">{l.recommended_action}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          <IconBtn testid={`view-${i}`} title="View details" onClick={() => setDetail(l)}><Eye className="h-3.5 w-3.5" /></IconBtn>
                          <IconBtn testid={`transfer-${i}`} title="Create transfer recommendation" onClick={() => { toast.success(`Transfer recommendation drafted for ${l.medicine}`); }}><ArrowLeftRight className="h-3.5 w-3.5" /></IconBtn>
                          <IconBtn testid={`flag-${i}`} title="Flag critical stock" onClick={() => { toast.warning(`${l.medicine} flagged as critical at ${l.phc}`); }}><Flag className="h-3.5 w-3.5" /></IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-slate-500">Showing {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} of {num(data.total)}</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="prev-page">Previous</Button>
                <span className="text-xs font-medium text-slate-600">Page {page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} data-testid="next-page">Next</Button>
              </div>
            </div>
          </>
        )}
      </Section>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle className="font-display">{detail?.medicine}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[["PHC", detail.phc], ["District", detail.district], ["State", detail.state], ["Batch", detail.batch_id],
                ["Current stock", num(detail.effective_stock) + " " + detail.unit], ["Daily consumption", num(detail.effective_daily_consumption)],
                ["Days remaining", detail.days_remaining], ["Lead time", detail.effective_lead_days + "d"],
                ["Predicted stock-out", fmtDate(detail.predicted_stockout_date)], ["Expiry", fmtDate(detail.expiry_date)]].map(([k, v]) => (
                  <div key={k}><p className="text-[11px] text-slate-400">{k}</p><p className="font-mono font-semibold text-slate-800">{v}</p></div>
                ))}
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="mb-1 flex items-center gap-2"><StatusBadge band={detail.risk_band} label={`Risk ${detail.risk_score}`} /></div>
                <p className="text-xs text-slate-600">Recommended: {detail.recommended_action}. Surge probability {Math.round(detail.surge_probability * 100)}%.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder, testid }) {
  return (
    <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
      <SelectTrigger data-testid={testid} className="h-9 w-40 bg-white text-sm"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent className="max-h-64 bg-white">
        {options.map(([v, l]) => <SelectItem key={v || "__all"} value={v || "__all"}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function IconBtn({ children, onClick, title, testid }) {
  return (
    <button onClick={onClick} title={title} data-testid={testid}
      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600">{children}</button>
  );
}
