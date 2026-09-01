import { cn } from "@/lib/utils";

interface Props {
  value: number;
  label?: string;
  caption?: string;
  size?: number;
  tone?: "brand" | "risk" | "trust";
  className?: string;
}

export function ConfidenceMeter({
  value,
  label = "Confidence",
  caption,
  size = 168,
  tone = "brand",
  className,
}: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    tone === "risk"
      ? "var(--color-destructive)"
      : tone === "trust"
        ? "var(--color-success)"
        : "var(--color-primary)";

  return (
    <div
      className={cn("flex flex-col items-center gap-2", className)}
      role="img"
      aria-label={`${label}: ${clamped} percent`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth={stroke}
            opacity={0.6}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-tight">{clamped}%</span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        </div>
      </div>
      {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

export function ScoreBar({
  label,
  score,
  polarity = "trust",
}: {
  label: string;
  score: number;
  polarity?: "risk" | "trust";
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const good = polarity === "trust" ? clamped >= 60 : clamped <= 40;
  const mid = polarity === "trust" ? clamped >= 40 : clamped <= 65;
  const barClass = good ? "bg-success" : mid ? "bg-warning" : "bg-destructive";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{clamped}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-700", barClass)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
