import type { NewsCategory, NewsItem } from "./types";

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (raw, ent: string) => {
    if (ent[0] === "#") {
      const code =
        ent[1] === "x" || ent[1] === "X"
          ? parseInt(ent.slice(2), 16)
          : parseInt(ent.slice(1), 10);
      if (!Number.isFinite(code)) return raw;
      try {
        return String.fromCodePoint(code);
      } catch {
        return raw;
      }
    }
    return NAMED[ent.toLowerCase()] ?? raw;
  });
}

export function stripCdata(input: string): string {
  return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

export function stripTags(input: string): string {
  return stripCdata(input)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<figure[\s\S]*?<\/figure>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanText(input: string): string {
  return decodeEntities(stripTags(input))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inner(block: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const match = block.match(re);
  return match?.[1] ? cleanText(match[1]) : "";
}

function extractLink(block: string): string {
  const alternate =
    block.match(
      /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i,
    ) ??
    block.match(
      /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["'][^>]*\/?>/i,
    );
  if (alternate?.[1]) return decodeEntities(alternate[1]);

  const href = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (href?.[1]) return decodeEntities(href[1]);

  return inner(block, "link");
}

function toIso(raw: string): string {
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function hashId(parts: string[]): string {
  const base = parts.join("|");
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function detectLanguage(text: string): NewsItem["language"] {
  if (/[\u3040-\u30ff\u4e00-\u9faf]/.test(text)) return "ja";
  if (/[a-zA-Z]/.test(text)) return "en";
  return "other";
}

const CATEGORY_RULES: Array<{ category: NewsCategory; pattern: RegExp }> = [
  {
    category: "policy",
    pattern:
      /規制|法案|政策|著作権|民主主義|ガバナンス|EU AI|white house|regulation|policy|lawsuit|禁令|安全設計|報告書|ハッキング/i,
  },
  {
    category: "research",
    pattern:
      /論文|研究|MIT|university|arxiv|benchmark|実験|学会|paper|study|research|scientist|検出する/i,
  },
  {
    category: "models",
    pattern:
      /GPT|Claude|Gemini|Grok|Llama|Mistral|DeepSeek|Qwen|LLM|foundation model|モデル発表|weights|ChatGPT/i,
  },
  {
    category: "industry",
    pattern:
      /投資|買収|上場|funding|acquires|partnership|調達|売上|時価総額|兆円|億ドル|支配/i,
  },
  {
    category: "products",
    pattern:
      /発売|公開|開始|開設|アップデート|機能|notebook|chatbot|エージェント|サービス|アプリ|活用/i,
  },
];

export function inferCategory(title: string, snippet: string): NewsCategory {
  const blob = `${title} ${snippet}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(blob)) return rule.category;
  }
  return "other";
}

export function isAiRelated(title: string, snippet: string): boolean {
  return /AI|ＡＩ|A\.I\.|LLM|GPT|Claude|Gemini|Grok|OpenAI|Anthropic|機械学習|人工知能|生成AI|ChatGPT|DeepSeek|NVIDIA|ニューラル|transformer|diffusion/i.test(
    `${title} ${snippet}`,
  );
}

function tidyTitle(title: string, source: string): string {
  let next = title.replace(/\s+/g, " ").trim();
  if (source) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next
      .replace(new RegExp(`\\s*[-–—|]\\s*${escaped}\\s*$`, "i"), "")
      .trim();
  }
  return next;
}

function snippetFrom(description: string, title: string): string {
  let text = description.replace(/&#8230;|\.{3}$/g, "…").trim();
  if (!text) return "";
  if (text.startsWith(title)) {
    const rest = text.slice(title.length).replace(/^[\s\-–—|]+/, "").trim();
    if (rest.length < 48) return "";
    text = rest;
  }
  if (text === title) return "";
  if (text.length > 420) {
    const cut = text.slice(0, 420);
    const at = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf(". "));
    text = (at > 160 ? cut.slice(0, at + 1) : cut).trim() + (at > 160 ? "" : "…");
  }
  return text;
}

export function parseFeedXml(
  xml: string,
  fallbackSource: string,
): Omit<NewsItem, "category" | "language">[] {
  const chunks = xml.split(/<(?:item|entry)(?:\s[^>]*)?>/i).slice(1);
  const items: Omit<NewsItem, "category" | "language">[] = [];

  for (const chunk of chunks) {
    const block = chunk.split(/<\/(?:item|entry)>/i)[0] ?? "";
    const titleRaw = inner(block, "title");
    if (!titleRaw) continue;

    const url = extractLink(block);
    if (!url || !url.startsWith("http")) continue;

    const source = inner(block, "source") || fallbackSource;
    const title = tidyTitle(titleRaw, source);

    const publishedAt =
      toIso(inner(block, "pubDate")) ||
      toIso(inner(block, "published")) ||
      toIso(inner(block, "updated")) ||
      toIso(inner(block, "dc:date")) ||
      "";

    const rawSnippet =
      inner(block, "description") ||
      inner(block, "summary") ||
      inner(block, "content:encoded") ||
      inner(block, "content") ||
      "";

    const snippet = snippetFrom(rawSnippet, title);
    items.push({
      id: hashId([source, url, title]),
      title,
      url,
      source: source || fallbackSource,
      publishedAt,
      snippet,
      summary: snippet,
    });
  }

  return items;
}

export function fromHnHits(
  hits: Array<{
    objectID?: string;
    title?: string;
    url?: string | null;
    created_at?: string;
    points?: number;
    story_id?: number;
  }>,
): Omit<NewsItem, "category" | "language">[] {
  return hits
    .filter((hit) => hit.title && hit.url && (hit.points ?? 0) >= 4)
    .map((hit) => ({
      id: hashId(["hn", hit.objectID ?? hit.title ?? ""]),
      title: hit.title ?? "",
      url: hit.url ?? "",
      source: "Hacker News",
      publishedAt: toIso(hit.created_at ?? ""),
      snippet: "",
      summary: "",
    }));
}

export function normalizeItem(
  item: Omit<NewsItem, "category" | "language">,
): NewsItem {
  return {
    ...item,
    language: detectLanguage(`${item.title} ${item.snippet}`),
    category: inferCategory(item.title, item.snippet),
  };
}

export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]+/gi, "")
    .slice(0, 48);
}

export function pickDiverse(items: NewsItem[], limit = 50): NewsItem[] {
  const byDate = (a: NewsItem, b: NewsItem) => {
    const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return db - da;
  };

  const withCopy = items.filter((item) => item.snippet.length >= 50).sort(byDate);
  const headlines = items.filter((item) => item.snippet.length < 50).sort(byDate);
  const picked: NewsItem[] = [];
  const seen = new Set<string>();
  const counts = new Map<string, number>();

  const take = (pool: NewsItem[], max: number, sourceCap: number) => {
    for (const cap of [sourceCap, sourceCap + 2, 99]) {
      for (const item of pool) {
        if (picked.length >= max) return;
        const key = titleKey(item.title);
        if (!key || seen.has(key) || seen.has(item.id)) continue;
        const n = counts.get(item.source) ?? 0;
        if (n >= cap) continue;
        picked.push(item);
        seen.add(key);
        seen.add(item.id);
        counts.set(item.source, n + 1);
      }
    }
  };

  take(withCopy, Math.min(Math.ceil(limit * 0.7), limit), 3);
  take(headlines, limit, 3);
  if (picked.length < limit) take([...items].sort(byDate), limit, 8);

  return picked.sort(byDate).slice(0, limit);
}
