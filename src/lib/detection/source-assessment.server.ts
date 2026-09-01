import type { SourceAssessment } from "./types";
import { classifySourceType, fetchPage, publisherFromUrl } from "./retrieval.server";

/**
 * Source quality evaluation.
 *
 * Deliberately NOT a "this domain is fake" blocklist. Every score point comes
 * from an observable property of the page itself, and each check reports why
 * it passed, failed, or could not be determined.
 */

function match(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m?.[1]?.trim() ?? null;
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export interface PageExtraction {
  assessment: SourceAssessment;
  title: string;
  text: string;
  reachable: boolean;
}

export async function assessSource(rawUrl: string): Promise<PageExtraction> {
  const domain = publisherFromUrl(rawUrl);
  const page = await fetchPage(rawUrl);
  const checks: SourceAssessment["checks"] = [];
  const notes: string[] = [];

  if (!page || page.status >= 400) {
    return {
      reachable: false,
      title: domain,
      text: "",
      assessment: {
        domain,
        author: null,
        publishedAt: null,
        originalSource: null,
        outboundLinks: null,
        citations: null,
        sourceKind: "unknown",
        credibilityScore: null,
        checks: [
          {
            label: "Page reachable",
            status: "fail",
            detail: page ? `The server responded with HTTP ${page.status}.` : "The page could not be fetched.",
          },
        ],
        notes: [
          "The article could not be retrieved, so no source-quality checks could be performed. Source reliability is undetermined, not poor.",
        ],
      },
    };
  }

  const html = page.html;
  const title =
    decode(match(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ?? "") ||
    decode(match(html, /<title[^>]*>([^<]{3,300})<\/title>/i) ?? "") ||
    domain;

  const author =
    match(html, /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i) ??
    match(html, /<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']+)["']/i) ??
    match(html, /"author"\s*:\s*{[^}]*"name"\s*:\s*"([^"]+)"/i);

  const publishedAt =
    match(html, /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i) ??
    match(html, /<time[^>]+datetime=["']([^"']+)["']/i) ??
    match(html, /"datePublished"\s*:\s*"([^"]+)"/i);

  const canonical = match(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);

  const bodyText = decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  );

  const links = [...html.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["']/gi)].map((m) => m[1] ?? "");
  const external = links.filter((href) => {
    try {
      return new URL(href).hostname.replace(/^www\./, "") !== domain;
    } catch {
      return false;
    }
  });
  const citations = external.filter((href) =>
    ["official", "academic"].includes(classifySourceType(href, "secondary")),
  );

  const hasSchemaNewsArticle = /"@type"\s*:\s*"(NewsArticle|ReportageNewsArticle|Article)"/i.test(html);
  const quotesPrimary = /according to|said in a statement|press release|official statement|study published/i.test(
    bodyText,
  );

  checks.push({
    label: "Page reachable",
    status: "pass",
    detail: `Fetched successfully (HTTP ${page.status}).`,
  });
  checks.push({
    label: "Author identified",
    status: author ? "pass" : "unknown",
    detail: author
      ? `Byline found: ${author}.`
      : "No author byline was found in the page metadata. Anonymous publishing is not proof of inaccuracy, but it removes accountability.",
  });
  checks.push({
    label: "Publication date present",
    status: publishedAt ? "pass" : "unknown",
    detail: publishedAt
      ? `Published/updated: ${publishedAt}.`
      : "No machine-readable publication date was found, so recency cannot be verified.",
  });
  checks.push({
    label: "External references",
    status: external.length >= 3 ? "pass" : external.length > 0 ? "unknown" : "fail",
    detail: `${external.length} outbound links to other domains were found, ${citations.length} of which point to official or academic sources.`,
  });
  checks.push({
    label: "Structured article metadata",
    status: hasSchemaNewsArticle ? "pass" : "unknown",
    detail: hasSchemaNewsArticle
      ? "The page declares structured news-article metadata."
      : "No structured news-article metadata was declared.",
  });
  checks.push({
    label: "Attribution to primary sources",
    status: quotesPrimary ? "pass" : "unknown",
    detail: quotesPrimary
      ? "The text attributes information to statements, studies, or releases."
      : "No explicit attribution language was detected in the article body.",
  });
  checks.push({
    label: "Canonical URL",
    status: canonical ? "pass" : "unknown",
    detail: canonical ? `Canonical URL: ${canonical}` : "No canonical URL declared, so the original source cannot be confirmed.",
  });

  const passes = checks.filter((c) => c.status === "pass").length;
  const credibilityScore = Math.round((passes / checks.length) * 100);

  notes.push(
    "This score reflects observable transparency practices only (authorship, dating, citations, structured metadata). It is not a measure of whether the content is true, and popularity is never counted as evidence.",
  );
  if (citations.length === 0)
    notes.push("No citations to official or academic sources were found on the page.");

  return {
    reachable: true,
    title,
    text: bodyText.slice(0, 12000),
    assessment: {
      domain,
      author,
      publishedAt,
      originalSource: canonical ?? page.finalUrl,
      outboundLinks: external.length,
      citations: citations.length,
      sourceKind: quotesPrimary || citations.length > 0 ? "secondary" : "unknown",
      credibilityScore,
      checks,
      notes,
    },
  };
}
