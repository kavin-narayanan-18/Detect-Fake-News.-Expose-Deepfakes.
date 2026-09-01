import { Link } from "@tanstack/react-router";
import { AlertTriangle, Download, ExternalLink, Info, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfidenceMeter, ScoreBar } from "./ConfidenceMeter";
import { RiskBadge, VerdictBadge } from "./RiskBadge";
import { CLAIM_STATUS_LABEL, type DetectionResult } from "@/lib/detection/types";
import { downloadReport } from "@/lib/report";
import { EvidencePanel } from "./EvidencePanel";
import { ManualVerificationGuide } from "./ManualVerificationGuide";

const stanceTone: Record<string, string> = {
  supports: "text-emerald-300",
  contradicts: "text-red-300",
  neutral: "text-muted-foreground",
};

export function ResultCard({
  result,
  analysisId,
  showActions = true,
}: {
  result: DetectionResult;
  analysisId?: string | undefined;
  showActions?: boolean;
}) {
  const undetermined = result.status === "unavailable" || result.confidence === null;
  const needsManualVerification =
    result.status === "unavailable" ||
    result.verdict === "Unable to Determine" ||
    result.verdict === "Insufficient Evidence";

  return (
    <section aria-label="Analysis result" className="space-y-6">
      <div className="glass-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {result.contentType} analysis · evidence strength: {result.evidenceStrength}
            </p>
            <h2 className="max-w-xl text-2xl font-bold tracking-tight">{result.title}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <VerdictBadge verdict={result.verdict} size="lg" />
              <RiskBadge level={result.riskLevel} />
            </div>
          </div>
          {undetermined ? (
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm text-muted-foreground">
              Confidence not reported — there was not enough evidence to calibrate a score.
            </div>
          ) : (
            <ConfidenceMeter
              value={result.confidence ?? 0}
              label="Confidence"
              tone={result.riskLevel === "Low" ? "trust" : "risk"}
              caption={`${result.confidenceLabel}${result.rawModelScore !== null ? ` · raw model score ${result.rawModelScore}` : ""}`}
            />
          )}
        </div>

        <p className="mt-6 flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          AI-assisted estimate based on the evidence retrieved at analysis time — not proof.
          {result.humanVerificationRecommended ? " Human verification is recommended." : ""}
        </p>

        {result.status === "unavailable" ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-border/60 bg-secondary/40 p-3 text-sm">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {result.unavailableReason}
          </p>
        ) : null}

        {showActions ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {analysisId ? (
              <Button variant="glass" size="sm" asChild>
                <Link to="/analysis/$id" params={{ id: analysisId }}>
                  View full report
                </Link>
              </Button>
            ) : null}
            <Button variant="glass" size="sm" onClick={() => downloadReport(result)}>
              <Download aria-hidden="true" /> Download report
            </Button>
          </div>
        ) : null}

        <p className="mt-4 text-xs text-muted-foreground">
          {result.model.name} v{result.model.version} · {result.model.provider} ·{" "}
          {result.model.calibrated ? "calibrated" : "uncalibrated"} · {result.processingMs} ms
        </p>
      </div>

      {result.claims.length ? (
        <div className="glass-card space-y-4 p-6">
          <h3 className="font-semibold">Claim-level assessment</h3>
          {result.claims.map((claim) => (
            <div key={claim.claim} className="rounded-xl border border-border/60 bg-secondary/20 p-4">
              <p className="font-medium">{claim.claim}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {CLAIM_STATUS_LABEL[claim.status]} · {Math.round(claim.confidence * 100)}% confidence
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{claim.reasoning}</p>
              {claim.evidence.length ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {claim.evidence.map((source) => (
                    <li key={source.id + source.url} className="flex gap-2">
                      <ExternalLink aria-hidden="true" className="mt-1 h-3.5 w-3.5 shrink-0" />
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
                        {source.publisher} — {source.title}
                      </a>
                      <span className={stanceTone[source.stance] ?? ""}>({source.stance})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No evidence retrieved for this claim.</p>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <EvidencePanel claims={result.claims} />

      {needsManualVerification ? <ManualVerificationGuide result={result} /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {result.signals.length ? (
          <div className="glass-card space-y-4 p-6">
            <h3 className="font-semibold">Signal breakdown</h3>
            {result.signals.map((signal) => (
              <div key={signal.label} className="space-y-1">
                {signal.value !== null ? (
                  <ScoreBar
                    label={signal.label}
                    score={signal.value}
                    polarity={signal.contribution === "raises_concern" ? "risk" : "trust"}
                  />
                ) : (
                  <p className="text-sm font-medium">{signal.label}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {signal.interpretation}
                  {signal.observationOnly ? " (Observation only — excluded from the verdict.)" : ""}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="glass-card space-y-3 p-6">
          <h3 className="flex items-center gap-2 font-semibold">
            <Lightbulb aria-hidden="true" className="h-4 w-4 text-accent" /> Why this result?
          </h3>
          <ul className="space-y-2 text-sm">
            {result.explanation.map((point) => (
              <li key={point} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {result.sourceAssessment ? (
        <div className="glass-card space-y-3 p-6">
          <h3 className="font-semibold">Source checks — {result.sourceAssessment.domain}</h3>
          <ul className="space-y-2 text-sm">
            {result.sourceAssessment.checks.map((check) => (
              <li key={check.label} className="rounded-lg border border-border/60 bg-secondary/20 p-3">
                <span className="font-medium">{check.label}:</span>{" "}
                <span className="uppercase text-xs tracking-wide text-muted-foreground">{check.status}</span>
                <p className="text-muted-foreground">{check.detail}</p>
              </li>
            ))}
          </ul>
          {result.sourceAssessment.notes.map((note) => (
            <p key={note} className="text-xs text-muted-foreground">
              {note}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card space-y-3 p-6">
          <h3 className="font-semibold">Limitations</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {result.limitations.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
        <div className="glass-card space-y-3 p-6">
          <h3 className="font-semibold">Recommended next steps</h3>
          <ol className="space-y-2 text-sm">
            {result.recommendations.map((rec, i) => (
              <li key={rec} className="flex gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span>{rec}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
