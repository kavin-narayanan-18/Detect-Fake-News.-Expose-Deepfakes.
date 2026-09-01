import type { EvidenceSource, SourceType, Stance } from "./types";
import { getDetectionConfig } from "./config.server";

/**
 * Evidence retrieval.
 *
 * Sources are only ever returned when they were actually retrieved from a
 * configured external service or fetched directly. Nothing is synthesised.
 */

const FACT_CHECK_ENDPOINT = "https://factchecktools.googleapis.com/v1alpha1/claims:search";

export function classifySourceType(url: string, fallback: SourceType = "secondary"): SourceType {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
  if (/\.gov(\.[a-z]{2})?$|\.mil$|\.int$|\.gov\./.test(host)) return "official";
  if (/\.edu(\.[a-z]{2})?$|\.ac\.[a-z]{2}$|doi\.org$|arxiv\.org$|pubmed|nih\.gov/.test(host))
    return "academic";
  if (/who\.int|un\.org|europa\.eu|worldbank\.org|imf\.org/.test(host)) return "official";
  return fallback;
}

export function publisherFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown publisher";
  }
}

/**
 * Maps a fact-checker's own textual rating to a stance. This uses the rating
 * the reviewer published — it is not a judgement about the publisher itself.
 */
export function stanceFromRating(rating: string): Stance {
  const r = rating.toLowerCase();
  if (/(^|\b)(false|fake|incorrect|debunk|hoax|misleading|no evidence|pants on fire|altered|fabricat)/.test(r))
    return "contradicts";
  if (/(^|\b)(true|correct|accurate|confirmed|verified|mostly true|supported)/.test(r))
    return "supports";
  return "neutral";
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Google Fact Check Tools API — returns published fact-check reviews. */
export async function searchFactChecks(query: string): Promise<EvidenceSource[]> {
  const cfg = getDetectionConfig();
  if (!cfg.factCheckApiKey) return [];
  const url = `${FACT_CHECK_ENDPOINT}?query=${encodeURIComponent(query.slice(0, 200))}&pageSize=5&key=${cfg.factCheckApiKey}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      console.error(`[retrieval] fact-check API ${res.status}`);
      return [];
    }
    const data = (await res.json()) as {
      claims?: {
        text?: string;
        claimDate?: string;
        claimReview?: {
          publisher?: { name?: string; site?: string };
          url?: string;
          title?: string;
          reviewDate?: string;
          textualRating?: string;
        }[];
      }[];
    };
    const out: EvidenceSource[] = [];
    for (const claim of data.claims ?? []) {
      for (const review of claim.claimReview ?? []) {
        if (!review.url) continue;
        const rating = review.textualRating ?? "";
        out.push({
          id: `fc-${out.length}`,
          title: review.title ?? claim.text ?? "Fact-check review",
          publisher: review.publisher?.name ?? publisherFromUrl(review.url),
          url: review.url,
          publishedAt: review.reviewDate ?? claim.claimDate ?? null,
          sourceType: "fact_check",
          stance: stanceFromRating(rating),
          snippet: rating ? `Fact-checker rating: "${rating}". Reviewed claim: ${claim.text ?? ""}`.trim() : (claim.text ?? ""),
          retrievedFrom: "Google Fact Check Tools API",
        });
      }
    }
    return out.slice(0, 6);
  } catch (error) {
    console.error("[retrieval] fact-check request failed", error);
    return [];
  }
}

interface GenericSearchResult {
  title?: string;
  link?: string;
  url?: string;
  snippet?: string;
  description?: string;
  date?: string;
  source?: string;
}

/**
 * Generic web search through a configurable endpoint (Serper, Brave, SearXNG…).
 * Stance is left neutral here — only the evidence-comparison step, reading the
 * retrieved text, may assign a stance.
 */
export async function searchWeb(query: string): Promise<EvidenceSource[]> {
  const cfg = getDetectionConfig();
  if (!cfg.searchApiUrl) return [];
  try {
    const isPost = /serper|post$/i.test(cfg.searchApiUrl);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (cfg.searchApiKey) {
      headers["X-API-KEY"] = cfg.searchApiKey;
      headers["Authorization"] = `Bearer ${cfg.searchApiKey}`;
      headers["X-Subscription-Token"] = cfg.searchApiKey;
    }
    const res = isPost
      ? await fetchWithTimeout(cfg.searchApiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ q: query.slice(0, 300), num: 6 }),
        })
      : await fetchWithTimeout(
          `${cfg.searchApiUrl}${cfg.searchApiUrl.includes("?") ? "&" : "?"}q=${encodeURIComponent(query.slice(0, 300))}`,
          { headers },
        );
    if (!res.ok) {
      console.error(`[retrieval] search API ${res.status}`);
      return [];
    }
    const data = (await res.json()) as Record<string, unknown>;
    const list =
      (data["organic"] as GenericSearchResult[] | undefined) ??
      (data["results"] as GenericSearchResult[] | undefined) ??
      ((data["web"] as { results?: GenericSearchResult[] } | undefined)?.results ?? []);
    return list.slice(0, 6).map((item, i) => {
      const link = item.link ?? item.url ?? "";
      return {
        id: `ws-${i}`,
        title: item.title ?? "Retrieved source",
        publisher: item.source ?? publisherFromUrl(link),
        url: link,
        publishedAt: item.date ?? null,
        sourceType: classifySourceType(link),
        stance: "neutral" as Stance,
        snippet: item.snippet ?? item.description ?? "",
        retrievedFrom: "Configured web search API",
      };
    }).filter((s) => s.url);
  } catch (error) {
    console.error("[retrieval] search request failed", error);
    return [];
  }
}

export interface FetchedPage {
  url: string;
  finalUrl: string;
  html: string;
  status: number;
}

/** Fetches the actual article so source checks use real page data. */
export async function fetchPage(url: string): Promise<FetchedPage | null> {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; TruthGuardBot/2.0; +https://truthguard.app/bot)",
          accept: "text/html,application/xhtml+xml",
        },
      },
      15000,
    );
    const html = await res.text();
    return { url, finalUrl: res.url || url, html: html.slice(0, 400_000), status: res.status };
  } catch (error) {
    console.error("[retrieval] page fetch failed", error);
    return null;
  }
}
