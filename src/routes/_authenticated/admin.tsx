import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, FileWarning, ShieldAlert, Users } from "lucide-react";
import { EmptyState, LoadingState, StatCard } from "@/components/truthguard/StatCard";
import { VerdictBadge } from "@/components/truthguard/RiskBadge";
import { listAnalyses } from "@/lib/analyses";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — TruthGuard" },
      { name: "description", content: "Platform-wide statistics for TruthGuard administrators." },
      { property: "og:title", content: "Admin dashboard — TruthGuard" },
      { property: "og:description", content: "System statistics and activity across the TruthGuard platform." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useAuth();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-analyses"],
    queryFn: listAnalyses,
    enabled: isAdmin,
  });

  const { data: userCount } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    enabled: isAdmin,
  });

  if (loading) return <LoadingState message="Checking permissions…" />;

  if (!isAdmin)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={ShieldAlert}
          title="Admin access required"
          description="Your account does not have the administrator role, so platform statistics are hidden."
        />
      </div>
    );

  if (isLoading) return <LoadingState message="Loading platform statistics…" />;

  const list = rows ?? [];
  const fake = list.filter((r) => r.verdict === "Contradicted").length;
  const deepfakes = list.filter((r) => r.verdict === "Potentially Misleading").length;

  const daily = Object.entries(
    list.reduce<Record<string, number>>((acc, r) => {
      const key = new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([date, count]) => ({ date, count }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Admin dashboard</h1>
      <p className="mt-1 text-muted-foreground">Platform-wide activity and system statistics.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={userCount ?? 0} icon={Users} />
        <StatCard label="Total analyses" value={list.length} icon={Activity} />
        <StatCard label="Fake news detections" value={fake} icon={FileWarning} />
        <StatCard label="Deepfake detections" value={deepfakes} icon={ShieldAlert} />
      </div>

      <div className="glass-card mt-6 p-6">
        <h2 className="mb-4 font-semibold">Daily activity</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
            <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
            <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
            <Bar dataKey="count" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card mt-6 overflow-x-auto p-6">
        <h2 className="mb-4 font-semibold">Recent analyses</h2>
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Recent analyses across the platform</caption>
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th scope="col" className="pb-2">Content</th>
              <th scope="col" className="pb-2">Type</th>
              <th scope="col" className="pb-2">Result</th>
              <th scope="col" className="pb-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, 15).map((row) => (
              <tr key={row.id} className="border-b border-border/40">
                <td className="max-w-[240px] truncate py-3">{row.title}</td>
                <td className="py-3 capitalize">{row.content_type}</td>
                <td className="py-3"><VerdictBadge verdict={row.verdict} /></td>
                <td className="py-3 text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
