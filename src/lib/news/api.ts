import { createServerFn } from "@tanstack/react-start";
import {
  fromHnHits,
  isAiRelated,
  normalizeItem,
  parseFeedXml,
  pickDiverse,
} from "./parse";
import { hasSummaryPassphrase, verifySummaryPassphrase } from "./passphrase";
import type {
  NewsCategory,
  NewsError,
  NewsItem,
  NewsPayload,
  SummarizePayload,
} from "./types";

const USER_AGENT =
  "Mozilla/5.0 (compatible; SignalDigest/1.0; +https://grok.com)";

const FEEDS: Array<{
  source: string;
  url: string;
  filterAi?: boolean;
}> = [
  {
    source: "Google ニュース",
    url: "https://news.google.com/rss/search?q=AI%20OR%20%E4%BA%BA%E5%B7%A5%E7%9F%A5%E8%83%BD%20OR%20ChatGPT%20OR%20LLM&hl=ja&gl=JP&ceid=JP:ja",
  },
  {
    source: "ITmedia AI+",
    url: "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",
  },
  {
    source: "Impress Watch",
    url: "https://www.watch.impress.co.jp/data/rss/1.0/ipw/feed.rdf",
    filterAi: true,
  },
  {
    source: "TechCrunch",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
  },
  {
    source: "The Verge",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
  },
  {
    source: "MIT News",
    url: "https://news.mit.edu/rss/topic/artificial-intelligence2",
  },
];

const RSS_TTL_MS = 5 * 60 * 1000;
const GROK_TTL_MS = 30 * 60 * 1000;
const MAX_ITEMS = 50;

type RssCache = { at: number; items: NewsItem[]; sourceCount: number };
type GrokCache = {
  key: string;
  at: number;
  byId: Record<string, { summary: string; category: NewsCategory }>;
};

let rssCache: RssCache | null = null;
let grokCache: GrokCache | null = null;

async function fetchText(url: string, timeoutMs = 8000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHn(): Promise<NewsItem[]> {
  const url =
    "https://hn.algolia.com/api/v1/search_by_date?query=AI%20OR%20LLM%20OR%20OpenAI%20OR%20Anthropic%20OR%20GPT&tags=story&hitsPerPage=50";
  const body = await fetchText(url, 7000);
  const json = JSON.parse(body) as {
    hits?: Array<{
      objectID?: string;
      title?: string;
      url?: string | null;
      created_at?: string;
      points?: number;
    }>;
  };
  return fromHnHits(json.hits ?? [])
    .filter((item) => isAiRelated(item.title, item.snippet))
    .map(normalizeItem);
}

async function fetchFeed(feed: (typeof FEEDS)[number]): Promise<NewsItem[]> {
  const xml = await fetchText(feed.url);
  return parseFeedXml(xml, feed.source)
    .filter((item) => (feed.filterAi ? isAiRelated(item.title, item.snippet) : true))
    .map(normalizeItem);
}

function applyGrok(items: NewsItem[]): NewsItem[] {
  if (!grokCache || Date.now() - grokCache.at > GROK_TTL_MS) return items;
  return items.map((item) => {
    const extra = grokCache?.byId[item.id];
    if (!extra) return item;
    return {
      ...item,
      grokSummary: extra.summary,
      summary: extra.summary,
      category: extra.category ?? item.category,
    };
  });
}

async function collectNews(): Promise<{ items: NewsItem[]; sourceCount: number }> {
  const tasks = [
    ...FEEDS.map((feed) => fetchFeed(feed)),
    fetchHn(),
  ];
  const settled = await Promise.allSettled(tasks);
  const pooled: NewsItem[] = [];
  let sourceCount = 0;

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    if (result.value.length > 0) sourceCount += 1;
    pooled.push(...result.value);
  }

  const cutoff = Date.now() - 21 * 24 * 60 * 60 * 1000;
  const fresh = pooled.filter((item) => {
    if (!item.publishedAt) return true;
    const t = Date.parse(item.publishedAt);
    return Number.isNaN(t) || t >= cutoff;
  });

  return { items: pickDiverse(fresh, MAX_ITEMS), sourceCount };
}

export const fetchNews = createServerFn({ method: "POST" })
  .validator((input: { force?: boolean } | undefined) => input ?? {})
  .handler(async ({ data }): Promise<NewsPayload | NewsError> => {
    try {
      const force = Boolean(data?.force);
      if (!force && rssCache && Date.now() - rssCache.at < RSS_TTL_MS) {
        return {
          ok: true,
          items: applyGrok(rssCache.items),
          fetchedAt: new Date(rssCache.at).toISOString(),
          aiAvailable: Boolean(process.env.XAI_API_KEY) && hasSummaryPassphrase(),
          sourceCount: rssCache.sourceCount,
        };
      }

      const collected = await collectNews();
      if (collected.items.length === 0) {
        return { ok: false, error: "ニュースを取得できませんでした。少し待って再試行してください。" };
      }

      rssCache = {
        at: Date.now(),
        items: collected.items,
        sourceCount: collected.sourceCount,
      };

      return {
        ok: true,
        items: applyGrok(collected.items),
        fetchedAt: new Date(rssCache.at).toISOString(),
        aiAvailable: Boolean(process.env.XAI_API_KEY) && hasSummaryPassphrase(),
        sourceCount: collected.sourceCount,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      return { ok: false, error: `ニュースの取得に失敗しました（${message}）` };
    }
  });

type SummarizeInput = {
  passphrase?: string;
  items: Array<{
    id: string;
    title: string;
    source: string;
    snippet: string;
  }>;
};

export const summarizeNews = createServerFn({ method: "POST" })
  .validator((input: SummarizeInput) => input)
  .handler(async ({ data }): Promise<SummarizePayload | NewsError> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "要約機能は現在利用できません。" };
    }
    if (!hasSummaryPassphrase()) {
      return { ok: false, error: "要約の合言葉が設定されていません。" };
    }
    if (!verifySummaryPassphrase(data.passphrase)) {
      return { ok: false, error: "合言葉が違います。" };
    }

    const items = data.items.slice(0, MAX_ITEMS);
    if (items.length === 0) {
      return { ok: false, error: "要約する記事がありません。" };
    }

    const key = items.map((item) => item.id).join(",");
    if (grokCache && grokCache.key === key && Date.now() - grokCache.at < GROK_TTL_MS) {
      return {
        ok: true,
        items: items.map((item) => {
          const cached = grokCache?.byId[item.id];
          return {
            id: item.id,
            summary: cached?.summary ?? item.snippet,
            category: cached?.category ?? "other",
          };
        }),
      };
    }

    const catalog = items
      .map(
        (item, i) =>
          `${i + 1}. id=${item.id}\nタイトル: ${item.title}\n媒体: ${item.source}\n抜粋: ${item.snippet || "（なし）"}`,
      )
      .join("\n\n");

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a Japanese news editor. Reply with JSON only. No markdown.",
          },
          {
            role: "user",
            content: `次のAI関連ニュースを、各2文程度の簡潔な日本語で要約してください。事実のみ。誇張・絵文字・英語のままの長文は禁止。不明な点は見出しから妥当に要約する。category は models / research / industry / policy / products / other のいずれか。

JSON形状:
{"items":[{"id":"...","summary":"...","category":"industry"}]}

ニュース:
${catalog}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return { ok: false, error: `要約APIエラー（${res.status}）` };
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    const parsed = parseSummaries(text);
    if (!parsed) {
      return { ok: false, error: "要約結果を解析できませんでした。" };
    }

    const byId: GrokCache["byId"] = {};
    for (const row of parsed) {
      if (!row.id || !row.summary) continue;
      byId[row.id] = {
        summary: row.summary.trim(),
        category: sanitizeCategory(row.category),
      };
    }

    grokCache = { key, at: Date.now(), byId };

    if (rssCache) {
      rssCache = { ...rssCache, items: applyGrok(rssCache.items) };
    }

    return {
      ok: true,
      items: items.map((item) => ({
        id: item.id,
        summary: byId[item.id]?.summary ?? item.snippet,
        category: byId[item.id]?.category ?? "other",
      })),
    };
  });

function sanitizeCategory(value: string | undefined): NewsCategory {
  const allowed: NewsCategory[] = [
    "models",
    "research",
    "industry",
    "policy",
    "products",
    "other",
  ];
  return allowed.includes(value as NewsCategory)
    ? (value as NewsCategory)
    : "other";
}

function parseSummaries(
  text: string,
): Array<{ id: string; summary: string; category: string }> | null {
  const trimmed = text.trim();
  const jsonText = (() => {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
    return trimmed;
  })();

  try {
    const data = JSON.parse(jsonText) as {
      items?: Array<{ id?: string; summary?: string; category?: string }>;
    };
    if (!Array.isArray(data.items)) return null;
    return data.items
      .filter((row) => row && row.id && row.summary)
      .map((row) => ({
        id: String(row.id),
        summary: String(row.summary),
        category: String(row.category ?? "other"),
      }));
  } catch {
    return null;
  }
}
