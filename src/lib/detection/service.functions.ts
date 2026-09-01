import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DETECTION_LIMITS } from "./limits";
import type { DetectionResult } from "./types";

/**
 * Public detection API surface. All model access, keys, prompts and retrieval
 * happen server-side; the client only ever receives a validated DetectionResult.
 */

const TextInput = z.object({
  text: z.string().trim().min(DETECTION_LIMITS.minTextLength).max(DETECTION_LIMITS.maxTextLength),
  title: z.string().trim().max(200).optional(),
});

const UrlInput = z.object({
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, "Enter a valid http(s) URL."),
});

const MediaInput = z.object({
  contentType: z.enum(["image", "video"]),
  title: z.string().trim().max(200),
  mime: z.string().max(100),
  /** base64 (no data: prefix) */
  data: z.string().max(140_000_000),
  durationSeconds: z.number().nullable().optional(),
  frames: z
    .array(z.object({ timestamp: z.number(), dataUrl: z.string().max(4_000_000) }))
    .max(DETECTION_LIMITS.videoFrameSamples)
    .optional(),
});

function failure(message: string, contentType: DetectionResult["contentType"], title: string): DetectionResult {
  return {
    status: "unavailable",
    unavailableReason: message,
    contentType,
    title,
    verdict: "Unable to Determine",
    confidence: null,
    confidenceLabel: "Calibrated model confidence",
    rawModelScore: null,
    evidenceStrength: "none",
    riskLevel: "Unknown",
    claims: [],
    sources: [],
    signals: [],
    sourceAssessment: null,
    media: null,
    explanation: [message],
    limitations: ["No verdict was produced. TruthGuard reports uncertainty instead of guessing."],
    recommendations: ["Try again shortly, or verify the content manually against a primary source."],
    humanVerificationRecommended: true,
    model: { name: "TruthGuard", version: "2.0.0", provider: "unavailable", calibrated: false },
    analyzedAt: new Date().toISOString(),
    processingMs: 0,
    demo: false,
  };
}

export const analyzeNewsText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TextInput.parse(input))
  .handler(async ({ data }): Promise<DetectionResult> => {
    const { runTextPipeline } = await import("./text-pipeline.server");
    const { ServiceUnavailableError } = await import("./config.server");
    const title = data.title?.trim() || `${data.text.slice(0, 70).trim()}…`;
    try {
      return await runTextPipeline({ contentType: "text", text: data.text, title });
    } catch (error) {
      if (error instanceof ServiceUnavailableError) return failure(error.message, "text", title);
      console.error("[detection] text pipeline failed", error);
      return failure("The verification pipeline failed before a verdict could be produced.", "text", title);
    }
  });

export const analyzeUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UrlInput.parse(input))
  .handler(async ({ data }): Promise<DetectionResult> => {
    const { runUrlPipeline } = await import("./text-pipeline.server");
    const { ServiceUnavailableError } = await import("./config.server");
    try {
      return await runUrlPipeline(data.url);
    } catch (error) {
      if (error instanceof ServiceUnavailableError) return failure(error.message, "url", data.url);
      console.error("[detection] url pipeline failed", error);
      return failure("The verification pipeline failed before a verdict could be produced.", "url", data.url);
    }
  });

export const analyzeMedia = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => MediaInput.parse(input))
  .handler(async ({ data }): Promise<DetectionResult> => {
    const { runMediaPipeline } = await import("./media-pipeline.server");
    try {
      const bytes = Uint8Array.from(Buffer.from(data.data, "base64"));
      const maxBytes =
        data.contentType === "image" ? DETECTION_LIMITS.maxImageBytes : DETECTION_LIMITS.maxVideoBytes;
      if (bytes.byteLength > maxBytes)
        return failure("The uploaded file exceeds the size limit.", data.contentType, data.title);
      return await runMediaPipeline({
        contentType: data.contentType,
        title: data.title,
        mime: data.mime,
        bytes,
        ...(data.frames ? { frames: data.frames } : {}),
        durationSeconds: data.durationSeconds ?? null,
      });
    } catch (error) {
      console.error("[detection] media pipeline failed", error);
      return failure(
        "The forensic pipeline failed before a result could be produced.",
        data.contentType,
        data.title,
      );
    }
  });

export const detectionCapabilities = createServerFn({ method: "GET" }).handler(async () => {
  const { capabilities } = await import("./config.server");
  return capabilities();
});
