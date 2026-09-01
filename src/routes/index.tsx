import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BrainCircuit,
  FileSearch,
  Globe2,
  ImageIcon,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/truthguard/StatCard";
import heroImage from "@/assets/hero-dashboard.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TruthGuard — Detect Fake News & Deepfakes with AI" },
      {
        name: "description",
        content:
          "TruthGuard analyses news articles, text, images and videos to estimate whether content is genuine, misleading or manipulated.",
      },
      { property: "og:title", content: "TruthGuard — Detect Fake News & Deepfakes with AI" },
      {
        property: "og:description",
        content:
          "AI-assisted verification for news, images and video. Confidence scores, signal breakdowns and clear explanations.",
      },
    ],
  }),
  component: Home,
});

const stats = [
  { icon: FileSearch, value: "10K+", label: "Content Analysed" },
  { icon: ShieldCheck, value: "95%", label: "Detection Accuracy" },
  { icon: Users, value: "5K+", label: "Users" },
  { icon: Activity, value: "24/7", label: "AI Analysis" },
];

const features = [
  {
    icon: Newspaper,
    title: "Fake News Detection",
    body: "Paste an article or claim and get a credibility score with a breakdown of emotional language, sourcing and sensationalism.",
  },
  {
    icon: ImageIcon,
    title: "Deepfake Image Detection",
    body: "Upload a photo to check for AI-generation markers, face manipulation, edge artefacts and metadata anomalies.",
  },
  {
    icon: Video,
    title: "Deepfake Video Detection",
    body: "Analyse footage frame by frame for facial motion irregularities and audio/video inconsistencies.",
  },
  {
    icon: Globe2,
    title: "Source & Credibility Analysis",
    body: "Enter a news URL to assess domain reputation, publication history and external verification status.",
  },
];

function Home() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="grid-mask absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2 lg:py-28">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              AI-assisted content verification
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Detect Fake News. <span className="gradient-text">Expose Deepfakes.</span> Discover
              the Truth.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              An AI-powered platform that analyses news, images, and videos to identify
              misinformation and manipulated content.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="hero" size="lg" asChild>
                <Link to="/detect">Start Detection</Link>
              </Button>
              <Button variant="glass" size="lg" asChild>
                <Link to="/learn">Explore Platform</Link>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <DemoBadge />
              <p className="text-xs text-muted-foreground">
                Results are AI-generated estimates, not absolute proof.
              </p>
            </div>
          </div>

          <div className="relative">
            <div
              aria-hidden="true"
              className="gradient-surface absolute -inset-6 rounded-[2.5rem] opacity-25 blur-3xl"
            />
            <img
              src={heroImage}
              width={1280}
              height={960}
              alt="Preview of the TruthGuard analysis dashboard showing a face-mesh scan, audio waveform and confidence gauge"
              className="animate-float relative rounded-3xl border border-border/60 shadow-2xl"
            />
          </div>
        </div>
      </section>

      <section aria-label="Platform statistics" className="mx-auto max-w-6xl px-4 py-8">
        <div className="glass-card grid grid-cols-2 gap-6 p-8 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <stat.icon aria-hidden="true" className="mx-auto mb-2 h-5 w-5 text-primary" />
              <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Sample/demo statistics shown for illustration — not measured performance.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Four detectors, one verdict
          </h2>
          <p className="mt-3 text-muted-foreground">
            Every analysis returns a standardised verdict, confidence score, signal breakdown and
            plain-language explanation.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="glass-card hover-lift p-6">
              <span className="gradient-surface mb-4 flex h-11 w-11 items-center justify-center rounded-xl">
                <feature.icon aria-hidden="true" className="h-5 w-5 text-primary-foreground" />
              </span>
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="glass-card flex flex-col items-center gap-4 p-10 text-center">
          <BrainCircuit aria-hidden="true" className="h-8 w-8 text-accent" />
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to verify something?
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Create a free account to save your analyses, track statistics and revisit detailed
            reports at any time.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="hero" size="lg" asChild>
              <Link to="/register">Create free account</Link>
            </Button>
            <Button variant="glass" size="lg" asChild>
              <Link to="/detect">Try a detection</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
