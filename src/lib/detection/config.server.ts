/**
 * Centralised, environment-driven configuration for every external detection
 * service. Nothing here is ever bundled into the client: this module is
 * server-only and all values are read at call time.
 */

export const MODEL_REGISTRY = {
  newsVerifier: { name: "TruthGuard-NewsVerifier", version: "2.0.0" },
  imageForensics: { name: "TruthGuard-ImageForensics", version: "2.0.0" },
  videoForensics: { name: "TruthGuard-VideoForensics", version: "2.0.0" },
  demo: { name: "TruthGuard-DemoFixture", version: "0.0.0-dev" },
} as const;

export interface DetectionConfig {
  llmApiKey: string | undefined;
  llmBaseUrl: string;
  llmModel: string;
  factCheckApiKey: string | undefined;
  /** Generic search endpoint (Serper / Brave / SearXNG compatible JSON). */
  searchApiUrl: string | undefined;
  searchApiKey: string | undefined;
  imageDetectionApiUrl: string | undefined;
  imageDetectionApiKey: string | undefined;
  videoDetectionApiUrl: string | undefined;
  videoDetectionApiKey: string | undefined;
}

export function getDetectionConfig(): DetectionConfig {
  return {
    llmApiKey: process.env['LOVABLE_API_KEY'] ?? process.env['LLM_API_KEY'],
    llmBaseUrl: process.env['LLM_API_URL'] ?? "https://ai.gateway.lovable.dev/v1",
    llmModel: process.env['LLM_MODEL'] ?? "google/gemini-3.6-flash",
    factCheckApiKey: process.env['FACT_CHECK_API_KEY'],
    searchApiUrl: process.env['SEARCH_API_URL'],
    searchApiKey: process.env['SEARCH_API_KEY'],
    imageDetectionApiUrl: process.env['IMAGE_DETECTION_API_URL'],
    imageDetectionApiKey: process.env['IMAGE_DETECTION_API_KEY'],
    videoDetectionApiUrl: process.env['VIDEO_DETECTION_API_URL'],
    videoDetectionApiKey: process.env['VIDEO_DETECTION_API_KEY'],
  };
}

/** Which capabilities are actually wired up right now. */
export function capabilities() {
  const cfg = getDetectionConfig();
  return {
    reasoning: Boolean(cfg.llmApiKey),
    factCheckApi: Boolean(cfg.factCheckApiKey),
    webSearch: Boolean(cfg.searchApiUrl),
    imageForensicsApi: Boolean(cfg.imageDetectionApiUrl),
    videoForensicsApi: Boolean(cfg.videoDetectionApiUrl),
  };
}

export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}
