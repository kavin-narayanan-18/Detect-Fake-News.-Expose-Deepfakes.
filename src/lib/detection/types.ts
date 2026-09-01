/**
 * Evidence-based detection contract.
 *
 * Every detector (text, url, image, video) resolves to a `DetectionResult`.
 * The contract is deliberately evidence-first: scores may be `null` when the
 * system cannot reliably determine them, and every number carries a label that
 * says whether it is calibrated or a raw model score.
 */

export type ContentType = "text" | "url" | "image" | "video";

/** Never "100% fake" / "100% genuine" — verdicts describe evidence, not truth. */
export type Verdict =
  | "Verified"
  | "Mostly Supported"
  | "Partially Supported"
  | "Unverified"
  | "Potentially Misleading"
  | "Contradicted"
  | "Insufficient Evidence"
  | "Unable to Determine";

export type ClaimStatus =
  | "supported"
  | "partially_supported"
  | "contradicted"
  | "insufficient_evidence";

export type EvidenceStrength = "none" | "low" | "moderate" | "high";

export type RiskLevel = "Low" | "Medium" | "High" | "Critical" | "Unknown";

export type SourceType =
  | "fact_check"
  | "primary"
  | "secondary"
  | "official"
  | "academic"
  | "user_provided"
  | "unknown";

export type Stance = "supports" | "contradicts" | "neutral";

export interface EvidenceSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string | null;
  sourceType: SourceType;
  stance: Stance;
  /** Verbatim snippet from the retrieved source — never invented by the model. */
  snippet: string;
  /** Retrieval provider that produced this source. */
  retrievedFrom: string;
}

export interface ClaimAssessment {
  claim: string;
  status: ClaimStatus;
  /** 0-1 calibrated confidence in the *status*, never in "truth" itself. */
  confidence: number;
  /** 0-1 raw model output before calibration. */
  rawScore: number | null;
  evidence: EvidenceSource[];
  reasoning: string;
}

export interface DetectionSignal {
  label: string;
  /** 0-100, or null when the signal could only be observed qualitatively. */
  value: number | null;
  interpretation: string;
  contribution: "supports_authentic" | "raises_concern" | "neutral";
  /** True when this is an observation only and must not drive the verdict. */
  observationOnly: boolean;
}

export interface SourceAssessment {
  domain: string | null;
  author: string | null;
  publishedAt: string | null;
  originalSource: string | null;
  outboundLinks: number | null;
  citations: number | null;
  sourceKind: "primary" | "secondary" | "unknown";
  /** 0-100 built from observable checks only — null when nothing observable. */
  credibilityScore: number | null;
  checks: { label: string; status: "pass" | "fail" | "unknown"; detail: string }[];
  notes: string[];
}

export interface FrameSample {
  frameNumber: number;
  timestamp: number;
  faceDetected: boolean | null;
  manipulationScore: number | null;
  artifactScore: number | null;
  note: string;
}

export interface SuspiciousSegment {
  startTime: number;
  endTime: number;
  score: number;
  reason: string;
}

export interface MediaAssessment {
  /** All 0-100 or null when the configured model could not produce them. */
  aiGenerationProbability: number | null;
  manipulationProbability: number | null;
  faceManipulationProbability: number | null;
  audioVideoConsistency: number | null;
  temporalConsistency: number | null;
  frames: FrameSample[];
  suspiciousSegments: SuspiciousSegment[];
  forensicObservations: DetectionSignal[];
}

export interface ModelInfo {
  name: string;
  version: string;
  provider: string;
  /** True when the numbers come from an uncalibrated raw model output. */
  calibrated: boolean;
}

export interface DetectionResult {
  status: "completed" | "unavailable";
  /** Present when status === "unavailable". */
  unavailableReason?: string;
  contentType: ContentType;
  title: string;
  verdict: Verdict;
  /** 0-100 calibrated confidence, or null when it cannot be determined. */
  confidence: number | null;
  confidenceLabel: "Calibrated model confidence" | "Uncalibrated model score";
  /** 0-1 raw model score kept for transparency. */
  rawModelScore: number | null;
  evidenceStrength: EvidenceStrength;
  riskLevel: RiskLevel;
  claims: ClaimAssessment[];
  sources: EvidenceSource[];
  signals: DetectionSignal[];
  sourceAssessment: SourceAssessment | null;
  media: MediaAssessment | null;
  /** Specific, signal-derived reasons — never "the AI said so". */
  explanation: string[];
  limitations: string[];
  recommendations: string[];
  humanVerificationRecommended: boolean;
  model: ModelInfo;
  analyzedAt: string;
  processingMs: number;
  /** True only in the explicitly labelled development Demo Mode. */
  demo: boolean;
}

export const VERDICT_TONE: Record<Verdict, "positive" | "caution" | "negative" | "neutral"> = {
  Verified: "positive",
  "Mostly Supported": "positive",
  "Partially Supported": "caution",
  Unverified: "neutral",
  "Potentially Misleading": "caution",
  Contradicted: "negative",
  "Insufficient Evidence": "neutral",
  "Unable to Determine": "neutral",
};

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  supported: "Supported",
  partially_supported: "Partially supported",
  contradicted: "Contradicted",
  insufficient_evidence: "Insufficient evidence",
};
