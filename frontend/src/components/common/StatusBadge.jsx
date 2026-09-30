import { riskStyle } from "../../lib/format";
import { cn } from "../../lib/utils";

export function StatusBadge({ band, label, className, pulse = false, testid }) {
  const s = riskStyle(band);
  return (
    <span
      data-testid={testid}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        s.bg, s.text, s.border, className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot, pulse && "animate-softpulse")} />
      {label || s.label}
    </span>
  );
}

export function Dot({ band, className }) {
  const s = riskStyle(band);
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", s.dot, className)} />;
}
