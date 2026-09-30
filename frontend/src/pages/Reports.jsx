import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Download, FileText, Eye, Loader2 } from "lucide-react";
import { useApi, get, API } from "../lib/api";
import { useApp } from "../context/AppContext";
import { PageHeader, Section } from "../components/common/PageHeader";
import { num } from "../lib/format";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

export default function Reports() {
  const { stateCode } = useApp();
  const { data } = useApi("/reports");
  const [preview, setPreview] = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  const generate = async (id) => {
    setLoadingId(id);
    try {
      const res = await get(`/reports/${id}`, { state_code: stateCode || undefined });
      setPreview(res);
      toast.success(`${res.name} generated (${res.row_count} rows)`);
    } catch { toast.error("Failed to generate report"); }
    finally { setLoadingId(null); }
  };

  const exportCsv = (id) => {
    const url = `${API}/reports/${id}/csv${stateCode ? `?state_code=${stateCode}` : ""}`;
    window.open(url, "_blank");
    toast.success("CSV export started");
  };

  const exportPdf = () => {
    if (!preview) { toast.info("Generate a report first"); return; }
    window.print();
    toast.success("Opening print / PDF dialog");
  };

  return (
    <div className="animate-fadeup">
      <PageHeader title="Reports & DPI Export"
        subtitle="Generate and export health resource reports from synthetic data. Export as CSV or PDF." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.reports || []).map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" data-testid={`report-${r.id}`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-display text-base font-bold text-slate-800">{r.name}</h3>
            <p className="mt-1 text-xs text-slate-500">Synthetic data{stateCode ? " · filtered by selected state" : " · national"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => generate(r.id)} data-testid={`generate-${r.id}`} className="bg-blue-600 hover:bg-blue-700">
                {loadingId === r.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />} Generate
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportCsv(r.id)} data-testid={`csv-${r.id}`}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
              </Button>
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <Section title={preview.name} className="mt-6"
          description={`Generated ${new Date(preview.generated_at).toLocaleString()} · ${preview.row_count} rows`}
          actions={
            <Button size="sm" variant="outline" onClick={exportPdf} data-testid="export-pdf-btn">
              <FileText className="mr-1.5 h-3.5 w-3.5" /> Export PDF
            </Button>
          }>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  {preview.columns.map((c) => <th key={c} className="pb-2 pr-3 font-semibold">{c}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.slice(0, 120).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    {row.map((cell, j) => (
                      <td key={j} className={cn("py-2 pr-3", j === 0 ? "font-medium text-slate-700" : "text-slate-500")}>{String(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 120 && <p className="mt-3 text-center text-xs text-slate-400">Showing first 120 of {num(preview.row_count)} rows. Export CSV for full data.</p>}
          </div>
        </Section>
      )}
    </div>
  );
}
