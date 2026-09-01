import type { DetectionResult } from "@/lib/detection/types";

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

/** Builds a printable HTML verification report from a stored/live result. */
export function buildReportHtml(
  result: DetectionResult,
  meta: { date?: string; user?: string } = {},
): string {
  const rows = (items: string[]) => items.map((i) => `<li>${esc(i)}</li>`).join("");
  const claims = result.claims
    .map(
      (c) => `<div class="claim">
        <p class="claim-text">${esc(c.claim)}</p>
        <p class="status">${esc(c.status.replace(/_/g, " "))} · confidence ${Math.round(c.confidence * 100)}%</p>
        <p>${esc(c.reasoning)}</p>
        <ul>${c.evidence.map((e) => `<li><a href="${esc(e.url)}">${esc(e.publisher)} — ${esc(e.title)}</a> (${esc(e.stance)})</li>`).join("")}</ul>
      </div>`,
    )
    .join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<title>TruthGuard report — ${esc(result.title)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:40px;color:#111;line-height:1.5}
h1{font-size:22px}h2{font-size:16px;margin-top:28px}
.badge{display:inline-block;padding:4px 10px;border:1px solid #999;border-radius:99px;font-size:12px}
.claim{border:1px solid #ddd;border-radius:8px;padding:12px;margin:10px 0}
.claim-text{font-weight:600}.status{color:#555;font-size:13px}
.note{background:#fff8e1;border:1px solid #f0d48a;padding:10px;border-radius:8px;font-size:13px}
small{color:#666}
</style></head><body>
<h1>TruthGuard verification report</h1>
<p><strong>${esc(result.title)}</strong><br/><small>${esc(result.contentType)} · ${esc(meta.date ?? new Date(result.analyzedAt).toLocaleString())}${meta.user ? ` · ${esc(meta.user)}` : ""}</small></p>
<p><span class="badge">${esc(result.verdict)}</span> <span class="badge">${esc(result.riskLevel)} risk</span>
<span class="badge">Evidence: ${esc(result.evidenceStrength)}</span>
<span class="badge">${result.confidence === null ? "Confidence undetermined" : `${result.confidence}% ${esc(result.confidenceLabel.toLowerCase())}`}</span></p>
<p class="note">This is an AI-assisted, evidence-based estimate — not proof. ${result.status === "unavailable" ? esc(result.unavailableReason ?? "") : "Always confirm with primary sources before acting."}</p>
<h2>Why this result</h2><ul>${rows(result.explanation)}</ul>
${claims ? `<h2>Claim-level assessment</h2>${claims}` : ""}
${result.sources.length ? `<h2>Evidence consulted</h2><ul>${result.sources.map((s) => `<li><a href="${esc(s.url)}">${esc(s.publisher)} — ${esc(s.title)}</a> · ${esc(s.sourceType)} · ${esc(s.stance)}</li>`).join("")}</ul>` : ""}
${result.signals.length ? `<h2>Signals</h2><ul>${result.signals.map((s) => `<li><strong>${esc(s.label)}</strong>${s.value === null ? "" : ` (${s.value}%)`}: ${esc(s.interpretation)}${s.observationOnly ? " <em>(observation only — not used in the verdict)</em>" : ""}</li>`).join("")}</ul>` : ""}
<h2>Limitations</h2><ul>${rows(result.limitations)}</ul>
<h2>Recommended next steps</h2><ul>${rows(result.recommendations)}</ul>
<p><small>Model: ${esc(result.model.name)} v${esc(result.model.version)} · ${esc(result.model.provider)} · ${result.model.calibrated ? "calibrated" : "uncalibrated"} · processed in ${result.processingMs} ms</small></p>
</body></html>`;
}

export function downloadReport(result: DetectionResult, meta: { date?: string; user?: string } = {}): void {
  const blob = new Blob([buildReportHtml(result, meta)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `truthguard-report-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
