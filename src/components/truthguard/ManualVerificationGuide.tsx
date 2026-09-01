import { CheckSquare, Compass, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DetectionResult } from "@/lib/detection/types";

const STEPS: { title: string; detail: string }[] = [
  {
    title: "Find the original source",
    detail:
      "Trace the claim back to the first outlet, document or account that published it. If you can only find reposts, treat it as unverified.",
  },
  {
    title: "Check who is reporting it",
    detail:
      "Look for a named author, a publication date, an About page and a way to contact the newsroom. Missing bylines and dates are warning signs.",
  },
  {
    title: "Look for independent confirmation",
    detail:
      "Search the core claim and see whether at least two unrelated, established outlets report the same facts — not the same wire copy.",
  },
  {
    title: "Verify the media itself",
    detail:
      "Run a reverse image search, check whether the footage appears in an older context, and look for content credentials (C2PA) or original camera metadata.",
  },
  {
    title: "Consult fact-checkers and primary records",
    detail:
      "Check dedicated fact-checking databases and, where relevant, official statistics, court filings, company statements or scientific papers.",
  },
];

const CITATION_CHECKS: string[] = [
  "Does every statistic name the study, agency or dataset it came from?",
  "Do the linked citations actually contain the claim, or only mention the topic?",
  "Are quotes reproduced in full context, with a date and a location?",
  "Is the cited source primary (the original record) or another article repeating it?",
  "Are the cited pages still live, or only preserved in an archive?",
];

const LINKS: { label: string; url: string }[] = [
  { label: "Google Fact Check Explorer", url: "https://toolbox.google.com/factcheck/explorer" },
  { label: "Google reverse image search", url: "https://images.google.com/" },
  { label: "TinEye reverse image search", url: "https://tineye.com/" },
  { label: "Wayback Machine", url: "https://web.archive.org/" },
];

export function ManualVerificationGuide({ result }: { result: DetectionResult }) {
  return (
    <section aria-label="Manual verification guide" className="glass-card space-y-5 p-6">
      <div className="space-y-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Compass aria-hidden="true" className="h-4 w-4 text-accent" /> Manual verification guide
        </h3>
        <p className="text-sm text-muted-foreground">
          {result.unavailableReason
            ? result.unavailableReason
            : "There was not enough evidence to reach a verdict automatically."}{" "}
          Work through these steps yourself before treating the content as true or false.
        </p>
      </div>

      <ol className="space-y-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3 rounded-xl border border-border/60 bg-secondary/20 p-4">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <span>
              <span className="block font-medium">{step.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="space-y-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <CheckSquare aria-hidden="true" className="h-4 w-4 text-accent" /> Citation checks
        </h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {CITATION_CHECKS.map((check) => (
            <li key={check} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{check}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        {LINKS.map((link) => (
          <Button key={link.url} variant="glass" size="sm" asChild>
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" /> {link.label}
            </a>
          </Button>
        ))}
      </div>
    </section>
  );
}
