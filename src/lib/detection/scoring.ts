import type {
  ClaimAssessment,
  ClaimStatus,
  EvidenceSource,
  EvidenceStrength,
  RiskLevel,
  SourceType,
  Verdict,
} from "./types";

/**
 * Transparent, deterministic aggregation and calibration.
 *
 * Nothing here is random and nothing is hardcoded per-domain: every number is
 * derived from the evidence actually retrieved for the claims being checked.
 */

/** How much a source of each kind contributes to evidence mass. */
export const SOURCE_WEIGHT: Record<SourceType, number> = {
  fact_check: 1,
  official: 0.95,
  academic: 0.9,
  primary: 0.85,
  secondary: 0.6,
  user_provided: 0.3,
  unknown: 0.3,
};

/** Recency does not decide truth, but stale evidence is weaker evidence. */
function recencyFactor(publishedAt: string | null): number {
  if (!publishedAt) return 0.85;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return 0.85;
  const years = (Date.now() - t) / (365.25 * 24 * 3600 * 1000);
  if (years < 0) return 0.85;
  return Math.max(0.6, 1 - years * 0.05);
}

export function sourceWeight(source: EvidenceSource): number {
  return SOURCE_WEIGHT[source.sourceType] * recencyFactor(source.publishedAt);
}

/** Independent corroboration: distinct publishers count more than repeats. */
export function evidenceMass(sources: EvidenceSource[]): number {
  const seen = new Map<string, number>();
  for (const s of sources) {
    if (s.stance === "neutral") continue;
    const key = s.publisher.toLowerCase();
    seen.set(key, Math.max(seen.get(key) ?? 0, sourceWeight(s)));
  }
  return [...seen.values()].reduce((a, b) => a + b, 0);
}

export function evidenceStrengthFrom(mass: number): EvidenceStrength {
  if (mass <= 0) return "none";
  if (mass < 1) return "low";
  if (mass < 2.5) return "moderate";
  return "high";
}

/**
 * Confidence calibration.
 *
 * A raw model probability is not real-world confidence. We shrink it toward
 * 0.5 (maximum uncertainty) in proportion to how little independent evidence
 * backs it, and we never allow a certainty above 0.95.
 */
export function calibrateConfidence(rawScore: number, mass: number): number {
  const raw = Math.max(0, Math.min(1, rawScore));
  const trust = Math.min(1, mass / 3); // 3 units of independent evidence = full trust
  const shrink = 0.35 + 0.6 * trust; // never fully trust a single model output
  const calibrated = 0.5 + (raw - 0.5) * shrink;
  return Math.max(0.05, Math.min(0.95, calibrated));
}

export interface Aggregate {
  verdict: Verdict;
  /** 0-100 or null when there is no evidence at all. */
  confidence: number | null;
  evidenceStrength: EvidenceStrength;
  riskLevel: RiskLevel;
  totalMass: number;
  supportedShare: number;
  contradictedShare: number;
}

const STATUS_SUPPORT: Record<ClaimStatus, number> = {
  supported: 1,
  partially_supported: 0.5,
  contradicted: 0,
  insufficient_evidence: 0,
};

/**
 * Weighted aggregation — deliberately not a blind average. Claims backed by
 * more independent, higher-quality evidence carry more weight, and a single
 * well-evidenced contradiction outweighs several weakly supported claims.
 */
export function aggregateClaims(claims: ClaimAssessment[]): Aggregate {
  if (claims.length === 0) {
    return {
      verdict: "Insufficient Evidence",
      confidence: null,
      evidenceStrength: "none",
      riskLevel: "Unknown",
      totalMass: 0,
      supportedShare: 0,
      contradictedShare: 0,
    };
  }

  let weightSum = 0;
  let supportSum = 0;
  let contradictSum = 0;
  let massSum = 0;

  for (const claim of claims) {
    const mass = evidenceMass(claim.evidence);
    massSum += mass;
    // Floor keeps unverifiable claims visible without letting them dominate.
    const weight = 0.35 + mass;
    weightSum += weight;
    supportSum += weight * STATUS_SUPPORT[claim.status] * claim.confidence;
    if (claim.status === "contradicted") contradictSum += weight * claim.confidence;
  }

  const supportedShare = weightSum > 0 ? supportSum / weightSum : 0;
  const contradictedShare = weightSum > 0 ? contradictSum / weightSum : 0;
  const strength = evidenceStrengthFrom(massSum);

  let verdict: Verdict;
  if (massSum <= 0) verdict = "Insufficient Evidence";
  else if (contradictedShare >= 0.45) verdict = "Contradicted";
  else if (contradictedShare >= 0.15) verdict = "Potentially Misleading";
  else if (supportedShare >= 0.8 && strength === "high") verdict = "Verified";
  else if (supportedShare >= 0.6) verdict = "Mostly Supported";
  else if (supportedShare >= 0.3) verdict = "Partially Supported";
  else verdict = "Unverified";

  // Confidence in the *assessment*, driven by evidence agreement and mass.
  const agreement = Math.max(supportedShare, contradictedShare);
  const confidence =
    massSum <= 0 ? null : Math.round(calibrateConfidence(0.5 + agreement / 2, massSum) * 100);

  const riskLevel: RiskLevel =
    verdict === "Contradicted"
      ? strength === "high"
        ? "Critical"
        : "High"
      : verdict === "Potentially Misleading"
        ? "High"
        : verdict === "Partially Supported"
          ? "Medium"
          : verdict === "Verified" || verdict === "Mostly Supported"
            ? "Low"
            : "Unknown";

  return {
    verdict,
    confidence,
    evidenceStrength: strength,
    riskLevel,
    totalMass: massSum,
    supportedShare,
    contradictedShare,
  };
}

export function needsHumanVerification(verdict: Verdict, strength: EvidenceStrength): boolean {
  if (strength === "high" && (verdict === "Verified" || verdict === "Contradicted")) return true;
  return true; // AI assessment alone is never sufficient — always recommend it.
}
