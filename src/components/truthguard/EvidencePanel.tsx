import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClaimAssessment, EvidenceSource, Stance } from "@/lib/detection/types";

const STANCE_LABEL: Record<Stance, string> = {
  supports: "Supporting",
  contradicts: "Contradicting",
  neutral: "Neutral / context",
};

const STANCE_STYLE: Record<Stance, string> = {
  supports: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  contradicts: "border-red-400/40 bg-red-400/10 text-red-300",
  neutral: "border-border/60 bg-secondary/40 text-muted-foreground",
};

type Filter = "all" | Stance;

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function EvidencePanel({ claims }: { claims: ClaimAssessment[] }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const sources = useMemo(() => {
    const map = new Map<string, EvidenceSource & { claims: string[] }>();
    for (const claim of claims) {
      for (const source of claim.evidence) {
        const key = source.url || source.id;
        const existing = map.get(key);
        if (existing) {
          if (!existing.claims.includes(claim.claim)) existing.claims.push(claim.claim);
        } else {
          map.set(key, { ...source, claims: [claim.claim] });
        }
      }
    }
    return [...map.values()];
  }, [claims]);

  const counts = useMemo(
    () => ({
      all: sources.length,
      supports: sources.filter((s) => s.stance === "supports").length,
      contradicts: sources.filter((s) => s.stance === "contradicts").length,
      neutral: sources.filter((s) => s.stance === "neutral").length,
    }),
    [sources],
  );

  const visible = filter === "all" ? sources : sources.filter((s) => s.stance === filter);

  if (!sources.length) {
    return (
      <div className="glass-card p-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <Library aria-hidden="true" className="h-4 w-4 text-accent" /> Evidence &amp; sources
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No sources were retrieved for this analysis, so nothing is listed here rather than showing
          placeholder citations.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="evidence-panel-body"
        className="flex w-full items-center justify-between gap-4 p-6 text-left"
      >
        <span className="space-y-1">
          <span className="flex items-center gap-2 font-semibold">
            <Library aria-hidden="true" className="h-4 w-4 text-accent" /> Evidence &amp; sources
            <span className="rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 text-xs text-muted-foreground">
              {counts.all}
            </span>
          </span>
          <span className="block text-xs text-muted-foreground">
            {counts.supports} supporting · {counts.contradicts} contradicting · {counts.neutral} neutral
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("h-5 w-5 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div id="evidence-panel-body" className="space-y-4 border-t border-border/60 p-6">
          <div className="flex flex-wrap gap-2">
            {(["all", "supports", "contradicts", "neutral"] as Filter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  filter === key
                    ? "border-primary/50 bg-primary/20 text-primary"
                    : "border-border/60 bg-secondary/30 text-muted-foreground hover:text-foreground",
                )}
              >
                {key === "all" ? "All" : STANCE_LABEL[key]} ({counts[key]})
              </button>
            ))}
          </div>

          <ul className="space-y-3">
            {visible.map((source) => (
              <li
                key={source.id + source.url}
                className="rounded-xl border border-border/60 bg-secondary/20 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium break-words">{source.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {source.publisher} · {hostOf(source.url)}
                      {source.publishedAt ? ` · ${new Date(source.publishedAt).toLocaleDateString()}` : ""}
                      {" · "}
                      {source.sourceType.replace(/_/g, " ")}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium",
                      STANCE_STYLE[source.stance],
                    )}
                  >
                    {STANCE_LABEL[source.stance]}
                  </span>
                </div>

                {source.snippet ? (
                  <blockquote className="mt-3 border-l-2 border-border/60 pl-3 text-sm text-muted-foreground">
                    {source.snippet}
                  </blockquote>
                ) : null}

                <p className="mt-3 text-xs text-muted-foreground">
                  Cited for: {source.claims.join(" · ")}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="glass" size="sm" asChild>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink aria-hidden="true" /> Open source
                    </a>
                  </Button>
                  <span className="text-xs text-muted-foreground">via {source.retrievedFrom}</span>
                </div>
              </li>
            ))}
          </ul>

          {!visible.length ? (
            <p className="text-sm text-muted-foreground">No sources match this filter.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
