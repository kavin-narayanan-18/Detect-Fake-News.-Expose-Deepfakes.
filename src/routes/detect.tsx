import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Image as ImageIcon, Link2, Loader2, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResultCard } from "@/components/truthguard/ResultCard";
import { FileUploader } from "@/components/truthguard/FileUploader";
import { analyzeMedia, analyzeNewsText, analyzeUrl } from "@/lib/detection/service.functions";
import { DETECTION_LIMITS } from "@/lib/detection/limits";
import type { DetectionResult } from "@/lib/detection/types";
import { saveAnalysis } from "@/lib/analyses";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/detect")({
  head: () => ({
    meta: [
      { title: "Verify content with evidence — TruthGuard" },
      {
        name: "description",
        content:
          "Check news text, links, images and video against retrieved evidence. Claim-level results with sources, limitations and calibrated confidence.",
      },
      { property: "og:title", content: "Verify content with evidence — TruthGuard" },
      {
        property: "og:description",
        content: "Evidence-based misinformation and deepfake checks with transparent claim-level scoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DetectPage,
});

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Samples real frames from the uploaded video in-browser for server-side inference. */
async function sampleFrames(file: File): Promise<{ frames: { timestamp: number; dataUrl: string }[]; duration: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("The video could not be decoded in this browser."));
  });
  const duration = video.duration || 0;
  const canvas = document.createElement("canvas");
  const frames: { timestamp: number; dataUrl: string }[] = [];
  const ctx = canvas.getContext("2d");
  for (let i = 0; ctx && i < DETECTION_LIMITS.videoFrameSamples && duration > 0; i += 1) {
    const t = (duration * (i + 0.5)) / DETECTION_LIMITS.videoFrameSamples;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = t;
    });
    const scale = Math.min(1, DETECTION_LIMITS.frameMaxEdge / Math.max(video.videoWidth, video.videoHeight || 1));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push({ timestamp: t, dataUrl: canvas.toDataURL("image/jpeg", 0.7) });
  }
  URL.revokeObjectURL(url);
  return { frames, duration };
}

function DetectPage() {
  const { user } = useAuth();
  const runText = useServerFn(analyzeNewsText);
  const runUrl = useServerFn(analyzeUrl);
  const runMedia = useServerFn(analyzeMedia);

  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [analysisId, setAnalysisId] = useState<string | undefined>(undefined);

  async function finish(outcome: DetectionResult, content?: string) {
    setResult(outcome);
    setAnalysisId(undefined);
    if (user) {
      try {
        const saved = await saveAnalysis(outcome, user.id, content);
        setAnalysisId(saved.id);
      } catch (error) {
        console.error(error);
        toast.error("The result could not be saved to your history.");
      }
    }
  }

  async function guard(run: () => Promise<void>) {
    setBusy(true);
    try {
      await run();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  const spinner = busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Verify content against evidence</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          TruthGuard extracts checkable claims, retrieves real sources, and scores each claim separately.
          When there isn't enough evidence, it says so instead of guessing.
        </p>
      </header>

      <Tabs defaultValue="text" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="text">
            <FileText aria-hidden="true" className="mr-2 h-4 w-4" /> Text
          </TabsTrigger>
          <TabsTrigger value="url">
            <Link2 aria-hidden="true" className="mr-2 h-4 w-4" /> Link
          </TabsTrigger>
          <TabsTrigger value="image">
            <ImageIcon aria-hidden="true" className="mr-2 h-4 w-4" /> Image
          </TabsTrigger>
          <TabsTrigger value="video">
            <Video aria-hidden="true" className="mr-2 h-4 w-4" /> Video
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="glass-card space-y-4 p-6">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            maxLength={DETECTION_LIMITS.maxTextLength}
            placeholder="Paste the article or claim you want checked…"
            aria-label="Text to analyse"
          />
          <p className="text-xs text-muted-foreground">
            {text.trim().length}/{DETECTION_LIMITS.maxTextLength} characters · minimum{" "}
            {DETECTION_LIMITS.minTextLength}
          </p>
          <Button
            variant="hero"
            disabled={busy || text.trim().length < DETECTION_LIMITS.minTextLength}
            onClick={() =>
              void guard(async () => {
                const outcome = await runText({ data: { text: text.trim() } });
                await finish(outcome, text.trim());
              })
            }
          >
            {spinner} Check claims
          </Button>
        </TabsContent>

        <TabsContent value="url" className="glass-card space-y-4 p-6">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            aria-label="URL to analyse"
          />
          <Button
            variant="hero"
            disabled={busy || !url.trim()}
            onClick={() =>
              void guard(async () => {
                const outcome = await runUrl({ data: { url: url.trim() } });
                await finish(outcome, url.trim());
              })
            }
          >
            {spinner} Analyse link
          </Button>
        </TabsContent>

        <TabsContent value="image" className="glass-card space-y-4 p-6">
          <FileUploader accept="image/*" label="Upload an image" hint="JPG, PNG or WEBP up to 10 MB" file={imageFile} onSelect={setImageFile} />
          <Button
            variant="hero"
            disabled={busy || !imageFile}
            onClick={() =>
              void guard(async () => {
                if (!imageFile) return;
                const outcome = await runMedia({
                  data: {
                    contentType: "image",
                    title: imageFile.name,
                    mime: imageFile.type,
                    data: await fileToBase64(imageFile),
                  },
                });
                await finish(outcome);
              })
            }
          >
            {spinner} Analyse image
          </Button>
        </TabsContent>

        <TabsContent value="video" className="glass-card space-y-4 p-6">
          <FileUploader accept="video/*" label="Upload a video" hint="MP4, MOV or WEBM up to 100 MB" file={videoFile} onSelect={setVideoFile} />
          <Button
            variant="hero"
            disabled={busy || !videoFile}
            onClick={() =>
              void guard(async () => {
                if (!videoFile) return;
                const { frames, duration } = await sampleFrames(videoFile);
                const outcome = await runMedia({
                  data: {
                    contentType: "video",
                    title: videoFile.name,
                    mime: videoFile.type,
                    data: await fileToBase64(new File([videoFile.slice(0, 2 * 1024 * 1024)], videoFile.name, { type: videoFile.type })),
                    durationSeconds: duration,
                    frames,
                  },
                });
                await finish(outcome);
              })
            }
          >
            {spinner} Analyse video
          </Button>
          <p className="text-xs text-muted-foreground">
            Frames are sampled in your browser and sent for forensic inference. No verdict is produced
            unless a forensics model is connected.
          </p>
        </TabsContent>
      </Tabs>

      {result ? (
        <div className="mt-10">
          <ResultCard result={result} analysisId={analysisId} />
        </div>
      ) : null}
    </div>
  );
}
