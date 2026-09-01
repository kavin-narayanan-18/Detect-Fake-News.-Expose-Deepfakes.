import { z } from "zod";
import { callJson } from "./llm.server";
import { searchFactChecks, searchWeb } from "./retrieval.server";
import { assessSource } from "./source-assessment.server";
import { getDetectionConfig, MODEL_REGISTRY, ServiceUnavailableError, capabilities } from "./config.server";
import { aggregateClaims, needsHumanVerification } from "./scoring";
import type {
  ClaimAssessment,
  DetectionResult,
  DetectionSignal,
  EvidenceSource,
  SourceAssessment,
} from "./types";

/**
 * Retrieval-augmented text/URL verification pipeline.
 *
 * Order matters: claims are extracted first, evidence is retrieved from real
 * external services second, and only then is the model allowed to reason —
 * strictly over the retrieved snippets. The model can never introduce a source.
 */

const ClaimExtraction = z.object({
  summary: z.string().max(600),
  language: z.string().max(40).optional(),
  claims: z
    .array(
      z.object({
        claim: z.string().min(5).max(400),
        checkworthy: z.boolean(),
        searchQuery: z.string().min(3).max(200),
      }),
    )
    .max(8),
  rhetoric: z
    .array(
      z.object({
        label: z.string().max(60),
        observed: z.boolean(),
        quote: z.string().max(300),
        explanation: z.string().max(300),
      }),
    )
    .max(6),
});

const StanceEvaluation = z.object({
  assessments: z.array(
    z.object({
      claimIndex: z.number().int().min(0),
      status: z.enum(["supported", "partially_supported", "contradicted", "insufficient_evidence"]),
      rawScore: z.number().min(0).max(1),
      reasoning: z.string().min(10).max(700),
      evidenceIds: z.array(z.string().max(20)).max(8),
      stances: z
        .array(
          z.object({
            evidenceId: z.string().max(20),
            stance: z.enum(["supports", "contradicts", "neutral"]),
          }),
        )
        .max(12),
    }),
  ),
});

const EXTRACTION_SYSTEM = `You extract verifiable factual claims from content for a fact-checking pipeline.
Rules:
- Extract only concrete, checkable assertions (who/what/when/where/how many). Ignore opinions.
- Never judge whether a claim is true. You have no evidence yet.
- searchQuery must be a neutral search phrase containing the key entities and numbers.
- rhetoric: report only rhetorical/manipulation techniques you can quote verbatim from the text (e.g. emotionally loaded language, absolutist wording, unnamed sources, urgency pressure, missing attribution). Set observed=false and quote="" when not present. These are observations, not evidence of falsehood.
Respond with JSON only: {"summary":string,"language":string,"claims":[{"claim":string,"checkworthy":boolean,"searchQuery":string}],"rhetoric":[{"label":string,"observed":boolean,"quote":string,"explanation":string}]}`;

const STANCE_SYSTEM = `You judge claims ONLY against the evidence snippets provided.
Hard rules:
- Never use outside knowledge as evidence, and never invent, guess, or cite a source that is not in the provided list.
- If the provided evidence does not directly address a claim, status MUST be "insufficient_evidence" with rawScore near 0.5.
- "supported" requires evidence explicitly confirming the claim. "contradicted" requires evidence explicitly refuting it.
- rawScore is your probability that the status is correct (0-1). Do not output 0 or 1.
- reasoning must reference specific evidence ids and quote the decisive wording.
- stances must list, for each evidence id you used, whether that source supports, contradicts, or is neutral to the claim.
Respond with JSON only: {"assessments":[{"claimIndex":number,"status":string,"rawScore":number,"reasoning":string,"evidenceIds":[string],"stances":[{"evidenceId":string,"stance":string}]}]}`;

function unavailable(
  contentType: DetectionResult["contentType"],
  title: string,
  reason: string,
  startedAt: number,
  limitations: string[],
  sourceAssessment: SourceAssessment | null = null,
): DetectionResult {
  return {
    status: "unavailable",
    unavailableReason: reason,
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
    sourceAssessment,
    media: null,
    explanation: [reason],
    limitations,
    recommendations: [
      "Check the claim directly with a primary source such as an official statement, dataset, or the organisation named in the content.",
      "Search established fact-checking organisations for the specific claim.",
    ],
    humanVerificationRecommended: true,
    model: {
      name: MODEL_REGISTRY.newsVerifier.name,
      version: MODEL_REGISTRY.newsVerifier.version,
      provider: "TruthGuard pipeline",
      calibrated: false,
    },
    analyzedAt: new Date().toISOString(),
    processingMs: Date.now() - startedAt,
    demo: false,
  };
}

function dedupeSources(sources: EvidenceSource[]): EvidenceSource[] {
  const seen = new Set<string>();
  const out: EvidenceSource[] = [];
  for (const s of sources) {
    const key = s.url.split("#")[0] ?? s.url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export interface TextPipelineInput {
  contentType: "text" | "url";
  text: string;
  title: string;
  sourceAssessment?: SourceAssessment | null;
}

export async function runTextPipeline(input: TextPipelineInput): Promise<DetectionResult> {
  const startedAt = Date.now();
  const caps = capabilities();
  const cfg = getDetectionConfig();
  const sourceAssessment = input.sourceAssessment ?? null;

  const limitations: string[] = [
    "This is an AI-assisted, evidence-based estimate — not proof. It reflects only the evidence retrieved at analysis time.",
    "Absence of evidence is not evidence of falsehood: recent, local, or niche claims are often unverifiable online.",
  ];
  if (!caps.factCheckApi)
    limitations.push("No fact-check database is connected, so published fact-check reviews were not consulted.");
  if (!caps.webSearch)
    limitations.push("No web search provider is connected, so independent corroboration could not be retrieved.");

  if (!caps.reasoning) {
    return unavailable(
      input.contentType,
      input.title,
      "The reasoning service is not configured, so no verdict can be produced.",
      startedAt,
      limitations,
      sourceAssessment,
    );
  }

  // 1. Claim extraction (no judgement).
  const extraction = await callJson(ClaimExtraction, {
    purpose: "claim-extraction",
    maxTokens: 1800,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM },
      { role: "user", content: `Content to analyse:\n"""\n${input.text.slice(0, 12000)}\n"""` },
    ],
  });

  const checkworthy = extraction.claims.filter((c) => c.checkworthy).slice(0, 5);

  // 2. Evidence retrieval from real providers only.
  const perClaimEvidence: EvidenceSource[][] = [];
  let counter = 0;
  for (const claim of checkworthy) {
    const [factChecks, web] = await Promise.all([
      searchFactChecks(claim.searchQuery),
      searchWeb(claim.searchQuery),
    ]);
    const merged = dedupeSources([...factChecks, ...web])
      .slice(0, 6)
      .map((s) => ({ ...s, id: `e${counter++}` }));
    perClaimEvidence.push(merged);
  }

  const allEvidence = perClaimEvidence.flat();

  if (checkworthy.length === 0) {
    return unavailable(
      input.contentType,
      input.title,
      "No concrete, checkable factual claims were found in this content, so there is nothing to verify against evidence.",
      startedAt,
      limitations,
      sourceAssessment,
    );
  }

  // 3. Stance evaluation, strictly over retrieved snippets.
  let claims: ClaimAssessment[] = [];
  if (allEvidence.length > 0) {
    const evidenceBlock = perClaimEvidence
      .map(
        (list, i) =>
          `CLAIM ${i}: ${checkworthy[i]?.claim ?? ""}\nEVIDENCE:\n` +
          (list.length
            ? list
                .map(
                  (e) =>
                    `- id=${e.id} | ${e.publisher} (${e.sourceType}${e.publishedAt ? `, ${e.publishedAt}` : ""}) | ${e.title}\n  snippet: ${e.snippet.slice(0, 600)}`,
                )
                .join("\n")
            : "  (no evidence retrieved)"),
      )
      .join("\n\n");

    const evaluation = await callJson(StanceEvaluation, {
      purpose: "stance-evaluation",
      maxTokens: 2500,
      messages: [
        { role: "system", content: STANCE_SYSTEM },
        { role: "user", content: evidenceBlock },
      ],
    });

    claims = checkworthy.map((claim, index) => {
      const found = evaluation.assessments.find((a) => a.claimIndex === index);
      const pool = perClaimEvidence[index] ?? [];
      const stanceById = new Map(found?.stances.map((s) => [s.evidenceId, s.stance]) ?? []);
      const used = (found?.evidenceIds ?? [])
        .map((id) => pool.find((e) => e.id === id))
        .filter((e): e is EvidenceSource => Boolean(e))
        .map((e) => ({ ...e, stance: stanceById.get(e.id) ?? e.stance }));
      const evidence = used.length ? used : pool.map((e) => ({ ...e, stance: stanceById.get(e.id) ?? e.stance }));
      const rawScore = found?.rawScore ?? null;
      const mass = evidence.filter((e) => e.stance !== "neutral").length;
      return {
        claim: claim.claim,
        status: found?.status ?? "insufficient_evidence",
        rawScore,
        confidence: rawScore === null ? 0.5 : Math.max(0.05, Math.min(0.95, rawScore * (mass > 0 ? 1 : 0.6))),
        evidence,
        reasoning:
          found?.reasoning ??
          "No evidence addressing this claim was retrieved, so its status could not be determined.",
      };
    });
  } else {
    claims = checkworthy.map((claim) => ({
      claim: claim.claim,
      status: "insufficient_evidence" as const,
      rawScore: null,
      confidence: 0.5,
      evidence: [],
      reasoning:
        "No external evidence could be retrieved for this claim, so it is recorded as unverified rather than false.",
    }));
  }

  const aggregate = aggregateClaims(claims);

  // 4. Signals — every one is derived from an observation, and rhetorical
  // observations are explicitly excluded from the verdict.
  const signals: DetectionSignal[] = [];
  const supported = claims.filter((c) => c.status === "supported").length;
  const contradicted = claims.filter((c) => c.status === "contradicted").length;
  const unresolved = claims.filter((c) => c.status === "insufficient_evidence").length;

  signals.push({
    label: "Claims corroborated by retrieved evidence",
    value: claims.length ? Math.round((supported / claims.length) * 100) : null,
    interpretation: `${supported} of ${claims.length} extracted claims were explicitly supported by retrieved sources.`,
    contribution: supported > 0 ? "supports_authentic" : "neutral",
    observationOnly: false,
  });
  signals.push({
    label: "Claims contradicted by retrieved evidence",
    value: claims.length ? Math.round((contradicted / claims.length) * 100) : null,
    interpretation: `${contradicted} of ${claims.length} extracted claims were explicitly refuted by retrieved sources.`,
    contribution: contradicted > 0 ? "raises_concern" : "neutral",
    observationOnly: false,
  });
  signals.push({
    label: "Unresolved claims",
    value: claims.length ? Math.round((unresolved / claims.length) * 100) : null,
    interpretation: `${unresolved} claims had no directly relevant evidence. Unresolved does not mean false.`,
    contribution: "neutral",
    observationOnly: false,
  });
  signals.push({
    label: "Independent evidence mass",
    value: Math.round(Math.min(1, aggregate.totalMass / 3) * 100),
    interpretation: `Weighted independent corroboration score across distinct publishers (${aggregate.evidenceStrength} strength).`,
    contribution: aggregate.totalMass >= 1 ? "supports_authentic" : "neutral",
    observationOnly: false,
  });

  for (const item of extraction.rhetoric.filter((r) => r.observed && r.quote)) {
    signals.push({
      label: item.label,
      value: null,
      interpretation: `${item.explanation} Quoted: "${item.quote}"`,
      contribution: "raises_concern",
      observationOnly: true,
    });
  }

  if (sourceAssessment?.credibilityScore !== null && sourceAssessment) {
    signals.push({
      label: "Source transparency practices",
      value: sourceAssessment.credibilityScore,
      interpretation: `${sourceAssessment.checks.filter((c) => c.status === "pass").length} of ${sourceAssessment.checks.length} transparency checks passed (authorship, dating, citations, metadata).`,
      contribution: (sourceAssessment.credibilityScore ?? 0) >= 60 ? "supports_authentic" : "raises_concern",
      observationOnly: true,
    });
  }

  const explanation: string[] = [];
  explanation.push(extraction.summary);
  for (const claim of claims.slice(0, 4)) {
    explanation.push(`"${claim.claim}" — ${claim.status.replace(/_/g, " ")}: ${claim.reasoning}`);
  }
  if (aggregate.totalMass <= 0)
    explanation.push(
      "No independent evidence was retrieved for any claim, so the verdict reflects a lack of information rather than a judgement about accuracy.",
    );

  const recommendations = [
    "Open the linked evidence and read the original wording before acting on this result.",
    "Look for the primary source (official statement, dataset, court filing, study) named in the claim.",
    contradicted > 0
      ? "Do not share this content until the contradicted claims are resolved against the cited fact-checks."
      : "Seek at least one additional independent source before sharing.",
    "Treat rhetorical observations as writing-style flags only — they are not evidence that a claim is false.",
  ];

  limitations.push(
    "Rhetorical and stylistic observations are reported separately and never contribute to the verdict.",
  );
  if (unresolved > 0)
    limitations.push(`${unresolved} claim(s) remain unresolved and are excluded from any support score.`);

  return {
    status: "completed",
    contentType: input.contentType,
    title: input.title,
    verdict: aggregate.verdict,
    confidence: aggregate.confidence,
    confidenceLabel: "Calibrated model confidence",
    rawModelScore:
      claims.length && claims.some((c) => c.rawScore !== null)
        ? Number(
            (
              claims.reduce((sum, c) => sum + (c.rawScore ?? 0), 0) /
              claims.filter((c) => c.rawScore !== null).length
            ).toFixed(3),
          )
        : null,
    evidenceStrength: aggregate.evidenceStrength,
    riskLevel: aggregate.riskLevel,
    claims,
    sources: dedupeSources(allEvidence),
    signals,
    sourceAssessment,
    media: null,
    explanation,
    limitations,
    recommendations,
    humanVerificationRecommended: needsHumanVerification(aggregate.verdict, aggregate.evidenceStrength),
    model: {
      name: MODEL_REGISTRY.newsVerifier.name,
      version: MODEL_REGISTRY.newsVerifier.version,
      provider: `Retrieval-augmented verification · ${cfg.llmModel}`,
      calibrated: true,
    },
    analyzedAt: new Date().toISOString(),
    processingMs: Date.now() - startedAt,
    demo: false,
  };
}

export async function runUrlPipeline(url: string): Promise<DetectionResult> {
  const startedAt = Date.now();
  const extraction = await assessSource(url);
  if (!extraction.reachable || extraction.text.length < 200) {
    return unavailable(
      "url",
      extraction.title,
      extraction.reachable
        ? "The page was reached but not enough readable article text could be extracted to verify any claim."
        : "The page could not be retrieved, so its claims could not be checked.",
      startedAt,
      [
        "Pages behind logins, paywalls, or bot protection cannot be analysed.",
        "This is an AI-assisted estimate, not proof.",
      ],
      extraction.assessment,
    );
  }
  const result = await runTextPipeline({
    contentType: "url",
    text: extraction.text,
    title: extraction.title,
    sourceAssessment: extraction.assessment,
  });
  return { ...result, processingMs: Date.now() - startedAt };
}

export { ServiceUnavailableError };
