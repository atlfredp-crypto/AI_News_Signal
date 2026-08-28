import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  ArrowUpRight,
  Bookmark,
  LoaderCircle,
  PenLine,
  RefreshCw,
} from "lucide-react";
import { fetchNews, summarizeNews } from "@/lib/news/api";
import { hydrateBookmarks, useBookmarks } from "@/lib/news/bookmarks";
import {
  CATEGORY_LABELS,
  NEWS_CATEGORIES,
  type FilterId,
  type NewsError,
  type NewsItem,
  type NewsPayload,
} from "@/lib/news/types";
import { InstallHint } from "@/components/news/install-hint";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatWhen(iso: string): string {
  if (!iso) return "日時不明";
  const date = parseISO(iso);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: ja });
}

function formatMastheadDate(iso?: string): string {
  const date = iso ? parseISO(iso) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return format(safe, "yyyy年M月d日（E）", { locale: ja });
}

function SignalMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <circle cx="16" cy="22" r="1.7" className="fill-foreground" />
      <path
        d="M12.2 18.4a5.4 5.4 0 0 1 7.6 0"
        className="stroke-foreground"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M9.4 15.2a9.2 9.2 0 0 1 13.2 0"
        className="stroke-accent"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.8 12a13 13 0 0 1 18.4 0"
        className="stroke-accent/70"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StoryMeta({ item }: { item: NewsItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium tracking-wide text-muted-foreground">
      <span>{item.source}</span>
      <span aria-hidden="true">/</span>
      <time
        dateTime={item.publishedAt}
        className="tabular-nums"
        suppressHydrationWarning
      >
        {formatWhen(item.publishedAt)}
      </time>
      {item.category !== "other" ? (
        <>
          <span aria-hidden="true">/</span>
          <span>{CATEGORY_LABELS[item.category]}</span>
        </>
      ) : null}
    </div>
  );
}

function StoryBody({
  item,
  featured = false,
  index,
}: {
  item: NewsItem;
  featured?: boolean;
  index: number;
}) {
  const [open, setOpen] = useState(featured);
  const hasHydrated = useBookmarks((state) => state.hasHydrated);
  const saved = useBookmarks(
    (state) =>
      hasHydrated &&
      state.items.some((row) => row.id === item.id || row.url === item.url),
  );
  const toggle = useBookmarks((state) => state.toggle);
  const summary = item.summary || item.snippet;
  const clamped = !featured && !open && summary.length > 140;

  return (
    <article
      className={cn(
        "story-enter border-border/80",
        featured ? "border-b pb-8" : "border-b py-5 last:border-b-0 last:pb-0",
      )}
      style={{ animationDelay: `${Math.min(index, 49) * 25}ms` }}
    >
      <div className={cn("flex gap-4", featured && "flex-col gap-5")}>
        {!featured ? (
          <span className="w-8 shrink-0 pt-1 font-display text-sm tabular-nums text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {featured ? (
            <p className="mb-4 text-kicker font-medium tracking-kicker text-muted-foreground">
              LEAD STORY
            </p>
          ) : null}
          <h2
            className={cn(
              "font-display text-pretty text-foreground",
              featured
                ? "text-lead leading-display tracking-display"
                : "text-xl leading-snug tracking-title",
            )}
          >
            {item.title}
          </h2>
          {summary ? (
            <p
              className={cn(
                "mt-3 max-w-prose text-pretty text-muted-foreground",
                featured ? "text-base leading-relaxed" : "text-sm leading-relaxed",
                clamped && "line-clamp-3",
              )}
            >
              {summary}
            </p>
          ) : null}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
            <StoryMeta item={item} />
            <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
              {!featured && summary.length > 140 ? (
                <button
                  type="button"
                  className="h-11 shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setOpen((v) => !v)}
                >
                  {open ? "閉じる" : "続きを読む"}
                </button>
              ) : null}
              <button
                type="button"
                aria-pressed={saved}
                onClick={() => toggle(item)}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium",
                  saved
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Bookmark
                  className={cn("size-3.5", saved && "fill-foreground")}
                />
                {saved ? "保存済み" : "保存"}
              </button>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-foreground hover:text-accent"
              >
                原文を読む
                <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function Digest({ initial }: { initial: NewsPayload | NewsError }) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [view, setView] = useState<"feed" | "saved">("feed");
  const hasHydrated = useBookmarks((state) => state.hasHydrated);
  const bookmarks = useBookmarks((state) => state.items);
  const savedItems = hasHydrated ? bookmarks : [];

  useEffect(() => {
    hydrateBookmarks();
  }, []);

  const [payload, setPayload] = useState<NewsPayload | NewsError>(initial);

  const refresh = useMutation({
    mutationFn: async () => {
      const result = await fetchNews({ data: { force: true } });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: (next) => {
      setPayload(next);
    },
  });

  const summarize = useMutation({
    mutationFn: async (list: NewsItem[]) => {
      const result = await summarizeNews({
        data: {
          items: list.map((item) => ({
            id: item.id,
            title: item.title,
            source: item.source,
            snippet: item.snippet || item.summary,
          })),
        },
      });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      setPayload((current) => {
        if (!current.ok) return current;
        const map = new Map(result.items.map((row) => [row.id, row]));
        return {
          ...current,
          items: current.items.map((item) => {
            const extra = map.get(item.id);
            if (!extra) return item;
            return {
              ...item,
              grokSummary: extra.summary,
              summary: extra.summary,
              category: extra.category ?? item.category,
            };
          }),
        };
      });
    },
  });

  const items = payload.ok ? payload.items : [];
  const visible = useMemo(() => {
    if (view === "saved") return savedItems;
    return filter === "all"
      ? items
      : items.filter((item) => item.category === filter);
  }, [filter, items, savedItems, view]);

  const featured = visible[0];
  const rest = visible.slice(1);
  const fetchedAt = payload.ok ? payload.fetchedAt : undefined;
  const aiAvailable = payload.ok ? payload.aiAvailable : false;
  const alreadySummarized =
    items.length > 0 && items.every((item) => Boolean(item.grokSummary));
  const refreshing = refresh.isPending;

  return (
    <div className="pwa-shell mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="mb-10">
        <div className="flex min-w-0 items-center justify-between gap-3 text-kicker font-medium text-muted-foreground">
          <time className="truncate tracking-kicker" suppressHydrationWarning>
            {formatMastheadDate(fetchedAt)}
          </time>
          <span className="shrink-0 tabular-nums tracking-kicker">
            {view === "saved"
              ? `${savedItems.length} SAVED`
              : items.length > 0
                ? `${items.length} STORIES`
                : "AI BRIEFING"}
          </span>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-3">
            <SignalMark className="size-8" />
            <p className="font-display text-display leading-none tracking-display text-foreground">
              Signal
            </p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            いま流れているAIニュースを、最大50本に圧縮した速報。
          </p>
          <InstallHint />
        </div>

        <div className="mt-8 h-px bg-foreground/80" />
        <div className="mt-1 h-px bg-border" />

        <div className="mt-5 flex min-w-0 flex-col gap-3">
          <nav
            aria-label="カテゴリ"
            className="flex max-w-full flex-wrap gap-1"
          >
            {NEWS_CATEGORIES.map((id) => {
              const active = view === "feed" && filter === id;
              const count =
                id === "all"
                  ? items.length
                  : items.filter((item) => item.category === id).length;
              if (id !== "all" && count === 0) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setView("feed");
                    setFilter(id);
                  }}
                  className={cn(
                    "h-11 shrink-0 px-3 text-sm font-medium transition-colors duration-150",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {CATEGORY_LABELS[id]}
                    <span className="tabular-nums text-xs opacity-60">{count}</span>
                  </span>
                  <span
                    className={cn(
                      "mt-1 block h-px w-full bg-foreground transition-opacity duration-150",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setView("saved")}
              className={cn(
                "h-11 shrink-0 px-3 text-sm font-medium transition-colors duration-150",
                view === "saved"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-2">
                保存
                <span className="tabular-nums text-xs opacity-60">
                  {savedItems.length}
                </span>
              </span>
              <span
                className={cn(
                  "mt-1 block h-px w-full bg-foreground transition-opacity duration-150",
                  view === "saved" ? "opacity-100" : "opacity-0",
                )}
              />
            </button>
          </nav>

          {view === "feed" ? (
            <div className="flex w-full min-w-0 gap-2 sm:w-auto sm:self-end">
              <Button
                variant="outline"
                size="sm"
                className="min-w-11 flex-1 sm:flex-none"
                onClick={() => refresh.mutate()}
                disabled={refreshing}
              >
                <RefreshCw className={cn(refreshing && "animate-spin")} />
                更新
              </Button>
              {aiAvailable ? (
                <Button
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => summarize.mutate(items)}
                  disabled={
                    summarize.isPending ||
                    items.length === 0 ||
                    alreadySummarized
                  }
                >
                  {summarize.isPending ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <PenLine />
                  )}
                  {alreadySummarized ? "要約済み" : "日本語で要約"}
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              保存はこのブラウザの中だけに残ります。別の端末・シークレットモード・サイトデータの削除では消えます。
            </p>
          )}
        </div>
      </header>

      {view === "feed" && !payload.ok ? (
        <div className="flex flex-col items-start gap-4 rounded-xl bg-card px-5 py-6 shadow-border">
          <p className="text-sm text-foreground">{payload.error}</p>
          <Button onClick={() => refresh.mutate()}>再試行</Button>
        </div>
      ) : null}

      {summarize.isError ? (
        <p className="mb-4 text-sm text-destructive" role="status">
          {summarize.error instanceof Error
            ? summarize.error.message
            : "要約に失敗しました。"}
        </p>
      ) : null}

      {view === "feed" && payload.ok && visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          このカテゴリの記事はまだありません。
        </p>
      ) : null}

      {view === "saved" && visible.length === 0 ? (
        <div className="rounded-xl bg-card px-5 py-8 shadow-border">
          <p className="font-display text-xl tracking-title text-foreground">
            保存した記事はまだありません
          </p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            気になった記事の「保存」を押すと、ここに残ります。速報が更新されても、あとから読み返せます。
          </p>
        </div>
      ) : null}

      {featured && view === "feed" ? (
        <div>
          <StoryBody item={featured} featured index={0} />
          {rest.length > 0 ? (
            <div className="mt-2">
              {rest.map((item, i) => (
                <StoryBody key={item.id} item={item} index={i + 1} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {view === "saved" && visible.length > 0 ? (
        <div>
          {visible.map((item, i) => (
            <StoryBody key={item.id} item={item} index={i} />
          ))}
        </div>
      ) : null}

      <footer className="mt-auto pt-12 text-xs leading-relaxed text-muted-foreground">
        情報源は公開RSS（Google
        ニュース、ITmedia AI+、Impress Watch、TechCrunch、The Verge、MIT
        News、Hacker News）。要約は見出しと抜粋をもとにした速報です。詳細は原文で確認してください。
      </footer>
    </div>
  );
}
