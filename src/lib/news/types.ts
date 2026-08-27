export const NEWS_CATEGORIES = [
  "all",
  "models",
  "research",
  "industry",
  "policy",
  "products",
] as const;

export type NewsCategory = Exclude<(typeof NEWS_CATEGORIES)[number], "all"> | "other";

export type FilterId = (typeof NEWS_CATEGORIES)[number];

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
  summary: string;
  grokSummary?: string;
  category: NewsCategory;
  language: "ja" | "en" | "other";
};

export type NewsPayload = {
  ok: true;
  items: NewsItem[];
  fetchedAt: string;
  aiAvailable: boolean;
  sourceCount: number;
};

export type NewsError = {
  ok: false;
  error: string;
};

export type SummarizePayload = {
  ok: true;
  items: Array<{ id: string; summary: string; category: NewsCategory }>;
};

export const CATEGORY_LABELS: Record<FilterId | "other", string> = {
  all: "すべて",
  models: "モデル",
  research: "研究",
  industry: "産業",
  policy: "政策",
  products: "プロダクト",
  other: "その他",
};
