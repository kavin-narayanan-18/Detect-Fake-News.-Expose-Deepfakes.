import { z } from "zod";
import { getDetectionConfig, ServiceUnavailableError } from "./config.server";

/**
 * Strict-JSON LLM client.
 *
 * The model is only ever used for *reasoning over supplied evidence* and for
 * claim extraction — never as an oracle that invents facts or sources. Every
 * response is schema-validated before it can reach the UI.
 */

export type LlmContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface LlmMessage {
  role: "system" | "user";
  content: string | LlmContent[];
}

interface CallOptions {
  messages: LlmMessage[];
  maxTokens?: number;
  /** Logged with the result so analyses stay auditable. */
  purpose: string;
}

async function rawCall({ messages, maxTokens = 2048, purpose }: CallOptions): Promise<string> {
  const cfg = getDetectionConfig();
  if (!cfg.llmApiKey) {
    throw new ServiceUnavailableError(
      "The reasoning service is not configured, so no assessment can be produced.",
    );
  }

  const response = await fetch(`${cfg.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.llmApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.llmModel,
      messages,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      stream: false,
    }),
  });

  if (response.status === 429) {
    throw new ServiceUnavailableError(
      "The reasoning service is rate limited right now. Please try again in a moment.",
    );
  }
  if (response.status === 402) {
    throw new ServiceUnavailableError(
      "The reasoning service has no remaining credits. Add credits to continue analysing content.",
    );
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[detection:${purpose}] gateway ${response.status}: ${detail.slice(0, 500)}`);
    throw new ServiceUnavailableError("Unable to connect to the verification service.");
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new ServiceUnavailableError("The verification service returned an empty response.");
  return content;
}

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new ServiceUnavailableError("The verification service returned an unreadable response.");
  }
}

/** Calls the model and validates the JSON response against a Zod schema. */
export async function callJson<T>(
  schema: z.ZodType<T>,
  options: CallOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const text = await rawCall(options);
      const parsed = schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      lastError = parsed.error;
      console.error(
        `[detection:${options.purpose}] schema validation failed`,
        parsed.error.issues.slice(0, 3),
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableError) throw error;
      lastError = error;
    }
  }
  console.error(`[detection:${options.purpose}] giving up`, lastError);
  throw new ServiceUnavailableError(
    "The verification service returned a response that could not be validated.",
  );
}
