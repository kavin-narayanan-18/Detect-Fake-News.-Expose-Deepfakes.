import { AlertTriangle, CheckCircle2, HelpCircle, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import type { RiskLevel, Verdict } from "@/lib/detection/types";
import { cn } from "@/lib/utils";

const verdictStyles: Record<Verdict, { className: string; Icon: typeof CheckCircle2 }> = {
  Verified: { className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: ShieldCheck },
  "Mostly Supported": { className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", Icon: CheckCircle2 },
  "Partially Supported": { className: "bg-amber-500/10 text-amber-300 border-amber-500/30", Icon: AlertTriangle },
  Unverified: { className: "bg-slate-500/10 text-slate-300 border-slate-400/25", Icon: HelpCircle },
  "Potentially Misleading": { className: "bg-orange-500/15 text-orange-300 border-orange-500/30", Icon: ShieldAlert },
  Contradicted: { className: "bg-red-500/15 text-red-300 border-red-500/30", Icon: XCircle },
  "Insufficient Evidence": { className: "bg-slate-500/10 text-slate-300 border-slate-400/25", Icon: HelpCircle },
  "Unable to Determine": { className: "bg-slate-500/10 text-slate-300 border-slate-400/25", Icon: HelpCircle },
};

const riskStyles: Record<RiskLevel, string> = {
  Low: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  Medium: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  High: "bg-orange-500/10 text-orange-300 border-orange-500/25",
  Critical: "bg-red-500/15 text-red-300 border-red-500/30",
  Unknown: "bg-slate-500/10 text-slate-300 border-slate-400/25",
};

export function VerdictBadge({ verdict, size = "md" }: { verdict: Verdict; size?: "md" | "lg" }) {
  const style = verdictStyles[verdict] ?? verdictStyles["Unable to Determine"];
  const { Icon } = style;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-semibold",
        style.className,
        size === "lg" ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-xs",
      )}
    >
      <Icon aria-hidden="true" className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      {verdict}
    </span>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        riskStyles[level] ?? riskStyles.Unknown,
      )}
    >
      {level === "Unknown" ? "Risk undetermined" : `${level} risk`}
    </span>
  );
}
