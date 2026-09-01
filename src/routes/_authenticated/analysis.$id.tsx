import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/truthguard/StatCard";
import { ResultCard } from "@/components/truthguard/ResultCard";
import { ScoreBar } from "@/components/truthguard/ConfidenceMeter";
import { getAnalysis, recordToResult } from "@/lib/analyses";
import { downloadReport } from "@/lib/report";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/analysis/$id")({
  head: () => ({
    meta: [
      { title: "Analysis report — TruthGuard" },
      { name: "description", content: "Detailed verification report with risk breakdown, explanation and recommendations." },
      { property: "og:title", content: "Analysis report — TruthGuard" },
      { property: "og:description", content: "Full TruthGuard detection report for a piece of analysed content." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalysisDetailPage,
});

function AnalysisDetailPage() {
  const { id } = Route.useParams();
  const { profile, user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => getAnalysis(id),
  });

  if (isLoading) return <LoadingState message="Loading report…" />;
  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      </div>
    );
  if (!data)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState message="This analysis could not be found." />
        <div className="mt-4 text-center">
          <Button variant="glass" asChild>
            <Link to="/history">Back to history</Link>
          </Button>
        </div>
      </div>
    );

  const result = recordToResult(data);
  const measured = result.signals.filter((s) => s.value !== null);


  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Detailed report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.contentType} · analysed {new Date(data.created_at).toLocaleString()} ·{" "}
            {profile?.full_name ?? user?.email ?? "You"}
          </p>
        </div>
        <Button
          variant="hero"
          onClick={() => {
            downloadReport(result, {
              date: new Date(data.created_at).toLocaleString(),
              ...(profile?.full_name ? { user: profile.full_name } : {}),
            });
          }}
        >
          <Download aria-hidden="true" /> Download report
        </Button>
      </div>

      <ResultCard result={result} showActions={false} />

      <div className="glass-card mt-6 space-y-4 p-6">
        <h2 className="font-semibold">Measured signals</h2>
        {measured.length ? (
          measured.map((signal) => (
            <ScoreBar
              key={signal.label}
              label={signal.label}
              score={signal.value ?? 0}
              polarity={signal.contribution === "raises_concern" ? "risk" : "trust"}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No numeric signals were produced for this analysis, so no scores are shown rather than
            estimated ones.
          </p>
        )}
      </div>


      {data.content ? (
        <div className="glass-card mt-6 p-6">
          <h2 className="mb-2 font-semibold">Analysed content</h2>
          <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {data.content}
          </p>
        </div>
      ) : null}
    </div>
  );
}
