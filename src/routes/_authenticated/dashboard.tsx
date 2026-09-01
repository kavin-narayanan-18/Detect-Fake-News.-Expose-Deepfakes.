import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, FileWarning, Gauge, ShieldCheck, Video } from "lucide-react";
import { StatCard, EmptyState, LoadingState, ErrorState } from "@/components/truthguard/StatCard";
import { VerdictBadge } from "@/components/truthguard/RiskBadge";
import { Button } from "@/components/ui/button";
import { listAnalyses } from "@/lib/analyses";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — TruthGuard" },
      { name: "description", content: "Your verification statistics, recent activity and detection analytics." },
      { property: "og:title", content: "Dashboard — TruthGuard" },
      { property: "og:description", content: "Track your content verifications and detection analytics." },
    ],
  }),
  component: DashboardPage,
});

const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)"];

function DashboardPage() {
  const { profile } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["analyses"],
    queryFn: listAnalyses,
  });

  if (isLoading) return <LoadingState message="Loading your dashboard…" />;
  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      </div>
    );

  const rows = data ?? [];
  const fake = rows.filter((r) => r.verdict === "Contradicted").length;
  const deepfakes = rows.filter((r) => r.verdict === "Potentially Misleading").length;
  const genuine = rows.filter((r) => r.verdict === "Verified" || r.verdict === "Mostly Supported").length;
  const avgConfidence = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + Number(r.confidence_score ?? 0), 0) / rows.length)
    : 0;

  const byDay = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      const key = new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([date, count]) => ({ date, count }))
    .reverse();

  const fakeVsGenuine = [
    { name: "Supported", value: genuine },
    { name: "Partially supported", value: rows.filter((r) => r.verdict === "Partially Supported").length },
    { name: "Contradicted", value: fake },
    { name: "Potentially misleading", value: deepfakes },
  ].filter((d) => d.value > 0);

  const byType = ["text", "url", "image", "video"].map((type) => ({
    type,
    count: rows.filter((r) => r.content_type === type).length,
  }));

  const confidenceSeries = rows
    .slice(0, 12)
    .reverse()
    .map((r, i) => ({ n: `#${i + 1}`, confidence: Number(r.confidence_score) }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!
        </h1>
        <p className="mt-1 text-muted-foreground">Your verification activity at a glance.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Analyses" value={rows.length} icon={Activity} />
        <StatCard label="Fake News Detected" value={fake} icon={FileWarning} />
        <StatCard label="Deepfakes Detected" value={deepfakes} icon={Video} />
        <StatCard label="Genuine Content" value={genuine} icon={ShieldCheck} />
        <StatCard label="Average Confidence" value={`${avgConfidence}%`} icon={Gauge} />
      </div>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Activity}
            title="No analyses yet"
            description="Run your first verification to start building statistics and history."
            action={
              <Button variant="hero" asChild>
                <Link to="/detect">Start detection</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="glass-card p-6">
              <h2 className="mb-4 font-semibold">Analyses over time</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Line type="monotone" dataKey="count" stroke="var(--color-chart-1)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-6">
              <h2 className="mb-4 font-semibold">Fake vs genuine</h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={fakeVsGenuine} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                    {fakeVsGenuine.map((entry, i) => (
                      <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-6">
              <h2 className="mb-4 font-semibold">News vs image vs video</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="type" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Bar dataKey="count" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-6">
              <h2 className="mb-4 font-semibold">Detection confidence</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={confidenceSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="n" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis domain={[0, 100]} stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Line type="monotone" dataKey="confidence" stroke="var(--color-chart-3)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="glass-card mt-6 overflow-x-auto p-6">
            <h2 className="mb-4 font-semibold">Recent activity</h2>
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Your most recent content analyses</caption>
              <thead>
                <tr className="border-b border-border/60 text-left text-muted-foreground">
                  <th scope="col" className="pb-2">Content</th>
                  <th scope="col" className="pb-2">Type</th>
                  <th scope="col" className="pb-2">Result</th>
                  <th scope="col" className="pb-2">Confidence</th>
                  <th scope="col" className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((row) => (
                  <tr key={row.id} className="border-b border-border/40">
                    <td className="max-w-[220px] truncate py-3">
                      <Link to="/analysis/$id" params={{ id: row.id }} className="hover:underline">
                        {row.title}
                      </Link>
                    </td>
                    <td className="py-3 capitalize">{row.content_type}</td>
                    <td className="py-3"><VerdictBadge verdict={row.verdict} /></td>
                    <td className="py-3 tabular-nums">{Math.round(Number(row.confidence_score))}%</td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
