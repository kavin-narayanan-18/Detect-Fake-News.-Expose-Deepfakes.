import { supabase } from "@/integrations/supabase/client";
import type { ContentType, DetectionResult, RiskLevel, Verdict } from "@/lib/detection/types";

export interface AnalysisRecord {
  id: string;
  user_id: string;
  title: string;
  content_type: ContentType;
  content: string | null;
  file_url: string | null;
  status: string | null;
  verdict: Verdict;
  risk_level: RiskLevel;
  confidence_score: number | null;
  credibility_score: number | null;
  manipulation_score: number | null;
  evidence_strength: string | null;
  model_name: string | null;
  model_version: string | null;
  processing_ms: number | null;
  explanation: string | null;
  result: DetectionResult | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Persists the complete structured result, including model + timing metadata. */
export async function saveAnalysis(
  result: DetectionResult,
  userId: string,
  content?: string,
): Promise<AnalysisRecord> {
  const { data, error } = await supabase
    .from("analyses")
    .insert({
      user_id: userId,
      title: result.title.slice(0, 300),
      content_type: result.contentType,
      content: content ?? null,
      status: result.status,
      verdict: result.verdict,
      risk_level: result.riskLevel,
      confidence_score: result.confidence,
      credibility_score: result.sourceAssessment?.credibilityScore ?? null,
      manipulation_score: result.media?.manipulationProbability ?? null,
      evidence_strength: result.evidenceStrength,
      model_name: result.model.name,
      model_version: result.model.version,
      processing_ms: result.processingMs,
      explanation: result.explanation.join("\n"),
      result: JSON.parse(JSON.stringify(result)),
      metadata: JSON.parse(
        JSON.stringify({
          provider: result.model.provider,
          calibrated: result.model.calibrated,
          demo: result.demo,
          claimCount: result.claims.length,
          sourceCount: result.sources.length,
        }),
      ),
    } as never)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as AnalysisRecord;
}

export async function listAnalyses(): Promise<AnalysisRecord[]> {
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AnalysisRecord[];
}

export async function getAnalysis(id: string): Promise<AnalysisRecord | null> {
  const { data, error } = await supabase.from("analyses").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as AnalysisRecord) ?? null;
}

export async function deleteAnalysis(id: string): Promise<void> {
  const { error } = await supabase.from("analyses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Rehydrates the stored structured result; older rows are shown as undetermined. */
export function recordToResult(record: AnalysisRecord): DetectionResult {
  if (record.result && typeof record.result === "object" && "verdict" in record.result) {
    return record.result;
  }
  return {
    status: "unavailable",
    unavailableReason: "This analysis was stored before the evidence-based engine and cannot be re-displayed in full.",
    contentType: record.content_type,
    title: record.title,
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
    explanation: [record.explanation ?? "No stored explanation."],
    limitations: ["Legacy record — re-run the analysis for an evidence-backed result."],
    recommendations: ["Re-run this content through the detector to get a current, evidence-based assessment."],
    humanVerificationRecommended: true,
    model: {
      name: record.model_name ?? "legacy",
      version: record.model_version ?? "1.0.0",
      provider: "legacy",
      calibrated: false,
    },
    analyzedAt: record.created_at,
    processingMs: record.processing_ms ?? 0,
    demo: false,
  };
}
