import { getDetectionConfig, MODEL_REGISTRY, capabilities } from "./config.server";
import { calibrateConfidence } from "./scoring";
import { sniffImageType } from "./limits";
import type {
  DetectionResult,
  DetectionSignal,
  FrameSample,
  MediaAssessment,
  SuspiciousSegment,
  Verdict,
} from "./types";

/**
 * Media forensics pipeline.
 *
 * There is NO heuristic guess here. Probabilities are produced only by a
 * configured forensic inference API. When none is configured the pipeline
 * returns "Unable to Determine" plus the container-level facts it could
 * genuinely observe (provenance metadata, EXIF, encoding), each marked as an
 * observation that must not be read as a deepfake verdict.
 */

interface InferenceResponse {
  aiGenerationProbability?: number;
  manipulationProbability?: number;
  faceManipulationProbability?: number;
  audioVideoConsistency?: number;
  temporalConsistency?: number;
  frames?: {
    frameNumber?: number;
    timestamp?: number;
    faceDetected?: boolean;
    manipulationScore?: number;
    artifactScore?: number;
    note?: string;
  }[];
  suspiciousSegments?: SuspiciousSegment[];
  observations?: { label: string; value?: number; interpretation: string }[];
  model?: { name?: string; version?: string };
}

function pct(value: number | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  const v = value > 1 ? value / 100 : value;
  return Math.round(Math.max(0, Math.min(1, v)) * 100);
}

/** Reads provenance/metadata facts that are actually present in the bytes. */
export function containerObservations(bytes: Uint8Array, mime: string): DetectionSignal[] {
  const signals: DetectionSignal[] = [];
  const head = new TextDecoder("latin1").decode(bytes.slice(0, Math.min(bytes.length, 200_000)));

  const sniffed = sniffImageType(bytes);
  if (sniffed) {
    signals.push({
      label: "Container format",
      value: null,
      interpretation:
        sniffed === mime
          ? `File bytes match the declared type (${sniffed}).`
          : `File bytes indicate ${sniffed} although the upload declared ${mime}. A mismatch usually means re-encoding, not manipulation.`,
      contribution: "neutral",
      observationOnly: true,
    });
  }

  const hasExif = head.includes("Exif") || head.includes("http://ns.adobe.com/xap");
  signals.push({
    label: "Capture metadata (EXIF/XMP)",
    value: null,
    interpretation: hasExif
      ? "Capture metadata is present in the file. Metadata can be edited, so it is not proof of authenticity."
      : "No capture metadata was found. Most social platforms strip metadata on upload, so this alone means nothing.",
    contribution: "neutral",
    observationOnly: true,
  });

  const c2pa = head.includes("c2pa") || head.includes("contentauth") || head.includes("jumb");
  signals.push({
    label: "C2PA content credentials",
    value: null,
    interpretation: c2pa
      ? "A content-credentials (C2PA) block was detected. Its cryptographic validity was not verified here."
      : "No C2PA content credentials were embedded, which is normal for most files today.",
    contribution: "neutral",
    observationOnly: true,
  });

  const editorTag = /Adobe|Photoshop|GIMP|Lightroom|Canva|Midjourney|Stable Diffusion|DALL/i.exec(head);
  if (editorTag) {
    signals.push({
      label: "Software marker in metadata",
      value: null,
      interpretation: `The metadata references "${editorTag[0]}". Editing software is used for legitimate cropping and colour work as well as manipulation.`,
      contribution: "neutral",
      observationOnly: true,
    });
  }

  return signals;
}

function unavailableMedia(
  contentType: "image" | "video",
  title: string,
  reason: string,
  observations: DetectionSignal[],
  startedAt: number,
): DetectionResult {
  const registry = contentType === "image" ? MODEL_REGISTRY.imageForensics : MODEL_REGISTRY.videoForensics;
  return {
    status: "unavailable",
    unavailableReason: reason,
    contentType,
    title,
    verdict: "Unable to Determine",
    confidence: null,
    confidenceLabel: "Uncalibrated model score",
    rawModelScore: null,
    evidenceStrength: "none",
    riskLevel: "Unknown",
    claims: [],
    sources: [],
    signals: observations,
    sourceAssessment: null,
    media: {
      aiGenerationProbability: null,
      manipulationProbability: null,
      faceManipulationProbability: null,
      audioVideoConsistency: null,
      temporalConsistency: null,
      frames: [],
      suspiciousSegments: [],
      forensicObservations: observations,
    },
    explanation: [
      reason,
      "The metadata observations below describe the file container only. They cannot establish whether the media is authentic or synthetic.",
    ],
    limitations: [
      "No forensic inference model is connected, so no AI-generation or manipulation probability can be reported.",
      "Metadata is trivially editable and is stripped by most platforms, so it is never used as a verdict.",
    ],
    recommendations: [
      "Run a reverse image or video search to find the earliest published version of this media.",
      "Look for the original poster and any higher-resolution copy; compression hides forensic traces.",
      "Ask a qualified forensic analyst if the outcome matters legally or journalistically.",
    ],
    humanVerificationRecommended: true,
    model: {
      name: registry.name,
      version: registry.version,
      provider: "No forensic model configured",
      calibrated: false,
    },
    analyzedAt: new Date().toISOString(),
    processingMs: Date.now() - startedAt,
    demo: false,
  };
}

function verdictFromMedia(media: MediaAssessment): { verdict: Verdict; risk: DetectionResult["riskLevel"] } {
  const scores = [media.aiGenerationProbability, media.manipulationProbability, media.faceManipulationProbability]
    .filter((v): v is number => v !== null);
  if (scores.length === 0) return { verdict: "Unable to Determine", risk: "Unknown" };
  const peak = Math.max(...scores);
  if (peak >= 70) return { verdict: "Contradicted", risk: "Critical" };
  if (peak >= 50) return { verdict: "Potentially Misleading", risk: "High" };
  if (peak >= 30) return { verdict: "Partially Supported", risk: "Medium" };
  if (peak >= 15) return { verdict: "Unverified", risk: "Low" };
  return { verdict: "Mostly Supported", risk: "Low" };
}

export interface MediaPipelineInput {
  contentType: "image" | "video";
  title: string;
  mime: string;
  bytes: Uint8Array;
  /** Base64 JPEG frames sampled client-side (video only). */
  frames?: { timestamp: number; dataUrl: string }[];
  durationSeconds?: number | null;
}

export async function runMediaPipeline(input: MediaPipelineInput): Promise<DetectionResult> {
  const startedAt = Date.now();
  const cfg = getDetectionConfig();
  const caps = capabilities();
  const observations = containerObservations(input.bytes, input.mime);

  const apiUrl = input.contentType === "image" ? cfg.imageDetectionApiUrl : cfg.videoDetectionApiUrl;
  const apiKey = input.contentType === "image" ? cfg.imageDetectionApiKey : cfg.videoDetectionApiKey;
  const configured = input.contentType === "image" ? caps.imageForensicsApi : caps.videoForensicsApi;

  if (!configured || !apiUrl) {
    return unavailableMedia(
      input.contentType,
      input.title,
      `No ${input.contentType} forensics model is connected, so TruthGuard cannot estimate whether this file is AI-generated or manipulated. Rather than guess, the result is reported as "Unable to determine".`,
      observations,
      startedAt,
    );
  }

  let payload: InferenceResponse;
  try {
    const body =
      input.contentType === "image"
        ? { mime: input.mime, image: Buffer.from(input.bytes).toString("base64") }
        : {
            mime: input.mime,
            durationSeconds: input.durationSeconds ?? null,
            frames: input.frames ?? [],
          };
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}`, "X-API-KEY": apiKey } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[media] forensics API ${res.status}: ${detail.slice(0, 300)}`);
      return unavailableMedia(
        input.contentType,
        input.title,
        `The forensics model responded with an error (HTTP ${res.status}), so no probability can be reported.`,
        observations,
        startedAt,
      );
    }
    payload = (await res.json()) as InferenceResponse;
  } catch (error) {
    console.error("[media] forensics request failed", error);
    return unavailableMedia(
      input.contentType,
      input.title,
      "The forensics model could not be reached, so no probability can be reported.",
      observations,
      startedAt,
    );
  }

  const frames: FrameSample[] = (payload.frames ?? []).map((f, i) => ({
    frameNumber: f.frameNumber ?? i,
    timestamp: f.timestamp ?? 0,
    faceDetected: f.faceDetected ?? null,
    manipulationScore: pct(f.manipulationScore),
    artifactScore: pct(f.artifactScore),
    note: f.note ?? "",
  }));

  const modelSignals: DetectionSignal[] = (payload.observations ?? []).map((o) => ({
    label: o.label,
    value: pct(o.value),
    interpretation: o.interpretation,
    contribution: (o.value ?? 0) > 0.5 ? "raises_concern" : "neutral",
    observationOnly: false,
  }));

  const media: MediaAssessment = {
    aiGenerationProbability: pct(payload.aiGenerationProbability),
    manipulationProbability: pct(payload.manipulationProbability),
    faceManipulationProbability: pct(payload.faceManipulationProbability),
    audioVideoConsistency: pct(payload.audioVideoConsistency),
    temporalConsistency: pct(payload.temporalConsistency),
    frames,
    suspiciousSegments: payload.suspiciousSegments ?? [],
    forensicObservations: [...modelSignals, ...observations],
  };

  const { verdict, risk } = verdictFromMedia(media);
  const scores = [media.aiGenerationProbability, media.manipulationProbability, media.faceManipulationProbability]
    .filter((v): v is number => v !== null);
  const raw = scores.length ? Math.max(...scores) / 100 : null;
  // A single model output carries little independent corroboration, so the
  // calibration layer deliberately shrinks it toward uncertainty.
  const confidence = raw === null ? null : Math.round(calibrateConfidence(raw, frames.length ? 1.2 : 0.6) * 100);
  const registry = input.contentType === "image" ? MODEL_REGISTRY.imageForensics : MODEL_REGISTRY.videoForensics;

  return {
    status: "completed",
    contentType: input.contentType,
    title: input.title,
    verdict,
    confidence,
    confidenceLabel: "Calibrated model confidence",
    rawModelScore: raw,
    evidenceStrength: scores.length ? "low" : "none",
    riskLevel: risk,
    claims: [],
    sources: [],
    signals: media.forensicObservations,
    sourceAssessment: null,
    media,
    explanation: [
      media.aiGenerationProbability !== null
        ? `The forensic model estimates a ${media.aiGenerationProbability}% likelihood that this media was fully AI-generated.`
        : "The model did not return an AI-generation estimate.",
      media.manipulationProbability !== null
        ? `Separately, it estimates a ${media.manipulationProbability}% likelihood of editing or manipulation of otherwise real media.`
        : "The model did not return a manipulation estimate.",
      ...(media.temporalConsistency !== null
        ? [`Temporal consistency across sampled frames scored ${media.temporalConsistency}%.`]
        : []),
      ...(media.audioVideoConsistency !== null
        ? [`Audio/visual synchronisation scored ${media.audioVideoConsistency}%.`]
        : []),
    ],
    limitations: [
      "AI generation and manipulation are scored separately; a high score on one does not imply the other.",
      "Compression, re-encoding, filters, and screenshots degrade forensic traces and can raise scores on authentic media.",
      "Forensic models generalise poorly to generators they were not trained on, so a low score is not proof of authenticity.",
    ],
    recommendations: [
      "Trace the earliest published copy of this media with a reverse search.",
      "Compare against the original upload rather than a re-shared, re-compressed copy.",
      "Escalate to a human forensic analyst before treating this result as conclusive.",
    ],
    humanVerificationRecommended: true,
    model: {
      name: payload.model?.name ?? registry.name,
      version: payload.model?.version ?? registry.version,
      provider: new URL(apiUrl).hostname,
      calibrated: true,
    },
    analyzedAt: new Date().toISOString(),
    processingMs: Date.now() - startedAt,
    demo: false,
  };
}
