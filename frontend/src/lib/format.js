export const nf = new Intl.NumberFormat("en-IN");

export function num(n) {
  if (n === null || n === undefined) return "—";
  return nf.format(Math.round(n));
}

export function compact(n) {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e7) return (n / 1e7).toFixed(2) + " Cr";
  if (abs >= 1e5) return (n / 1e5).toFixed(2) + " L";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return nf.format(Math.round(n));
}

export function pct(n) {
  if (n === null || n === undefined) return "—";
  return `${n}%`;
}

export function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function fmtTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function timeAgo(iso) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export const RISK = {
  low: { label: "Low", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", ring: "ring-emerald-500" },
  moderate: { label: "Moderate", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500", ring: "ring-amber-500" },
  high: { label: "High", text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500", ring: "ring-orange-500" },
  critical: { label: "Critical", text: "text-red-700", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500", ring: "ring-red-500" },
  healthy: { label: "Healthy", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", ring: "ring-emerald-500" },
  warning: { label: "Warning", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500", ring: "ring-amber-500" },
};

export function riskStyle(band) {
  return RISK[band] || RISK.low;
}
