import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History as HistoryIcon, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/truthguard/StatCard";
import { VerdictBadge } from "@/components/truthguard/RiskBadge";
import { deleteAnalysis, listAnalyses } from "@/lib/analyses";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Analysis History — TruthGuard" },
      { name: "description", content: "Search, filter and review every content verification you have run." },
      { property: "og:title", content: "Analysis History — TruthGuard" },
      { property: "og:description", content: "All of your previous TruthGuard analyses in one place." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["analyses"], queryFn: listAnalyses });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [verdict, setVerdict] = useState("all");
  const [sort, setSort] = useState("newest");

  const remove = useMutation({
    mutationFn: deleteAnalysis,
    onSuccess: () => {
      toast.success("Analysis deleted");
      void queryClient.invalidateQueries({ queryKey: ["analyses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    let list = data ?? [];
    if (search.trim())
      list = list.filter((r) => r.title.toLowerCase().includes(search.trim().toLowerCase()));
    if (type !== "all") list = list.filter((r) => r.content_type === type);
    if (verdict !== "all") list = list.filter((r) => r.verdict === verdict);
    return [...list].sort((a, b) =>
      sort === "newest"
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [data, search, type, verdict, sort]);

  if (isLoading) return <LoadingState message="Loading your history…" />;
  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Analysis history</h1>
        <p className="mt-1 text-muted-foreground">Search, filter and revisit your past checks.</p>
      </header>

      <div className="glass-card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="search">Search</Label>
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title…" className="pl-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type-filter">Content type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="type-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="url">URL</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="verdict-filter">Result</Label>
          <Select value={verdict} onValueChange={setVerdict}>
            <SelectTrigger id="verdict-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All results</SelectItem>
              <SelectItem value="Genuine">Genuine</SelectItem>
              <SelectItem value="Likely Genuine">Likely Genuine</SelectItem>
              <SelectItem value="Suspicious">Suspicious</SelectItem>
              <SelectItem value="Likely Fake">Likely Fake</SelectItem>
              <SelectItem value="Deepfake Suspected">Deepfake Suspected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sort">Sort by date</Label>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger id="sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={HistoryIcon}
            title="Nothing to show"
            description="No analyses match your filters yet."
            action={
              <Button variant="hero" asChild>
                <Link to="/detect">Run an analysis</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="glass-card flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{row.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="capitalize">{row.content_type}</span> ·{" "}
                  {Math.round(Number(row.confidence_score))}% confidence ·{" "}
                  {new Date(row.created_at).toLocaleString()}
                </p>
              </div>
              <VerdictBadge verdict={row.verdict} />
              <div className="flex gap-2">
                <Button variant="glass" size="sm" asChild>
                  <Link to="/analysis/$id" params={{ id: row.id }}>View details</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete analysis ${row.title}`}
                  onClick={() => remove.mutate(row.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
