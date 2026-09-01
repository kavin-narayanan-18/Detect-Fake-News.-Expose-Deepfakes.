import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BookOpen, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      { title: "Learn to Spot Misinformation — TruthGuard" },
      {
        name: "description",
        content:
          "Guides on fake news, deepfakes, AI-generated imagery, source verification and practical fact-checking steps.",
      },
      { property: "og:title", content: "Learn to Spot Misinformation — TruthGuard" },
      {
        property: "og:description",
        content: "Understand deepfakes, misinformation techniques and how to fact-check claims online.",
      },
    ],
  }),
  component: LearnPage,
});

const articles = [
  {
    title: "What is Fake News?",
    body: "Fake news is fabricated or deliberately distorted information presented as legitimate journalism. It ranges from entirely invented stories to real events reframed with misleading context. It spreads because emotionally charged content travels faster than measured reporting.",
  },
  {
    title: "What is a Deepfake?",
    body: "A deepfake is synthetic media in which a person's face, voice or body is replaced or generated using deep-learning models. Modern generative models can reproduce facial expressions and speech patterns convincingly, though subtle artefacts often remain around edges, teeth, hair and lighting.",
  },
  {
    title: "How AI-Generated Images Work",
    body: "Diffusion models start from random noise and iteratively denoise it toward a description. Because they learn statistical patterns rather than physical scenes, they can produce inconsistent shadows, malformed hands, unreadable text and unusually smooth skin texture.",
  },
  {
    title: "How to Verify News Sources",
    body: "Check whether the outlet has an editorial policy, named authors, corrections page and a verifiable postal address. Look up the domain registration date — misinformation sites are often created days before a major event.",
  },
  {
    title: "How to Identify Manipulated Videos",
    body: "Watch for irregular blinking, mismatched lip-sync, flickering around the jawline, inconsistent lighting between the face and background, and audio that lacks room reverberation matching the scene.",
  },
  {
    title: "Common Misinformation Techniques",
    body: "Recontextualised real footage, cherry-picked statistics, fabricated quotes, impersonated official accounts, misleading headlines paired with accurate body text, and coordinated amplification by inauthentic accounts.",
  },
  {
    title: "How to Fact-Check Online Claims",
    body: "Trace the claim to its original source, search for the exact phrasing to find earlier versions, use reverse image search on any accompanying visual, and check whether established fact-checking organisations have already assessed it.",
  },
];

const steps = [
  "Check the source — is the outlet identifiable and accountable?",
  "Check the author — do they exist and have a track record?",
  "Check the date — is old content being recycled as new?",
  "Compare multiple sources — is anyone else reporting this?",
  "Verify the original evidence — find the primary document, photo or recording.",
];

function LearnPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <header className="text-center">
        <span className="gradient-surface mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
          <BookOpen aria-hidden="true" className="h-6 w-6 text-primary-foreground" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Learn to Spot Misinformation
        </h1>
        <p className="mt-3 text-muted-foreground">
          Tools help, but critical reading is the strongest defence. Start here.
        </p>
      </header>

      <section className="glass-card mt-10 p-6 sm:p-8">
        <h2 className="mb-4 text-xl font-semibold">5 Steps to Verify Information</h2>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                {i + 1}
              </span>
              <span className="text-sm">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="glass-card mt-8 p-6 sm:p-8">
        <h2 className="mb-4 text-xl font-semibold">Guides</h2>
        <Accordion type="single" collapsible className="w-full">
          {articles.map((article) => (
            <AccordionItem key={article.title} value={article.title}>
              <AccordionTrigger className="text-left">{article.title}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {article.body}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <p className="mt-8 flex items-start gap-2 rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm text-muted-foreground">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        No automated tool is a substitute for verification. Treat every TruthGuard verdict as a
        starting point for your own research.
      </p>
    </div>
  );
}
