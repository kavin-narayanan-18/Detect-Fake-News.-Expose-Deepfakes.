import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Layers, Target, TriangleAlert, Rocket } from "lucide-react";
import { DemoBadge } from "@/components/truthguard/StatCard";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About TruthGuard — How the platform works" },
      {
        name: "description",
        content:
          "TruthGuard's objective, technology stack, analysis workflow, current limitations and planned improvements.",
      },
      { property: "og:title", content: "About TruthGuard — How the platform works" },
      {
        property: "og:description",
        content: "Objective, technologies, workflow, limitations and roadmap of the TruthGuard verification platform.",
      },
    ],
  }),
  component: AboutPage,
});

const workflow = ["User", "Upload / Paste Content", "AI Analysis", "Risk Assessment", "Explanation", "Verification Recommendation"];

function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About TruthGuard</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          TruthGuard is an AI-assisted content verification platform designed to help users identify
          potentially misleading news and manipulated digital media.
        </p>
        <div className="mt-4 flex justify-center">
          <DemoBadge />
        </div>
      </header>

      <section className="glass-card mt-10 p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Target aria-hidden="true" className="h-5 w-5 text-primary" /> Project objective
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Misinformation spreads faster than corrections. TruthGuard's objective is to give everyday
          readers a structured, explainable first-pass assessment of news text, article URLs, images
          and video — paired with education that builds long-term verification habits rather than
          blind trust in an automated score.
        </p>
      </section>

      <section className="glass-card mt-6 p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Layers aria-hidden="true" className="h-5 w-5 text-primary" /> Key technologies
        </h2>
        <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li>React 19 + TypeScript</li>
          <li>Vite build tooling</li>
          <li>Tailwind CSS + shadcn/ui</li>
          <li>Lucide React iconography</li>
          <li>Recharts analytics</li>
          <li>Cloud authentication &amp; Postgres database</li>
          <li>Row-level security for per-user data isolation</li>
          <li>Pluggable detection service layer</li>
        </ul>
      </section>

      <section className="glass-card mt-6 p-6 sm:p-8">
        <h2 className="text-xl font-semibold">How the system works</h2>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {workflow.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                {step}
              </span>
              {i < workflow.length - 1 ? (
                <ArrowRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              ) : null}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Content never bypasses the service layer: components call{" "}
          <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">analyzeNewsText()</code>,{" "}
          <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">analyzeUrl()</code>,{" "}
          <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">analyzeImage()</code> or{" "}
          <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">analyzeVideo()</code>, which
          resolve to whichever detection provider is configured.
        </p>
      </section>

      <section id="limitations" className="glass-card mt-6 border-warning/40 p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <TriangleAlert aria-hidden="true" className="h-5 w-5 text-warning" /> Limitations
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            • No real detection model is connected. The platform currently runs a clearly labelled
            demo engine that produces deterministic sample results for interface testing.
          </li>
          <li>• URL analysis does not fetch page content; it evaluates domain heuristics only.</li>
          <li>• Image and video scores are illustrative and must not be cited as evidence.</li>
          <li>• Statistics shown on the landing page are sample values, not measured accuracy.</li>
        </ul>
      </section>

      <section className="glass-card mt-6 p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Rocket aria-hidden="true" className="h-5 w-5 text-accent" /> Future improvements
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• Connect an LLM/NLP service for claim extraction and stance detection.</li>
          <li>• Integrate fact-checking databases for claim matching.</li>
          <li>• Add a computer-vision deepfake classifier for images and video frames.</li>
          <li>• Reverse image search for provenance tracing.</li>
          <li>• Community reporting and moderator review queues.</li>
        </ul>
      </section>

      <section id="privacy" className="glass-card mt-6 p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Privacy</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Analyses are stored against your account and protected by row-level security, so only you
          (and platform administrators for aggregate statistics) can access them. Uploaded files are
          processed in your browser in demo mode and are not transmitted to third parties. You can
          delete any analysis from your history at any time.
        </p>
      </section>

      <section id="terms" className="glass-card mt-6 p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Terms</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          TruthGuard is provided for educational and research purposes. Detection results are
          AI-generated estimates and must not be treated as proof of authenticity or fabrication. Do
          not rely on this platform for legal, journalistic or safety-critical decisions.
        </p>
      </section>
    </div>
  );
}
