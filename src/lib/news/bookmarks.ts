import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { NewsItem } from "./types";

export type Bookmark = NewsItem & { savedAt: string };

type BookmarkState = {
  items: Bookmark[];
  hasHydrated: boolean;
  toggle: (item: NewsItem) => void;
};

function sameStory(
  a: Pick<NewsItem, "id" | "url">,
  b: Pick<NewsItem, "id" | "url">,
): boolean {
  if (a.id && a.id === b.id) return true;
  return Boolean(a.url && b.url && a.url === b.url);
}

export const useBookmarks = create<BookmarkState>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,
      toggle: (item) => {
        const current = get().items;
        const exists = current.some((row) => sameStory(row, item));
        set({
          items: exists
            ? current.filter((row) => !sameStory(row, item))
            : [
                { ...item, savedAt: new Date().toISOString() },
                ...current,
              ].slice(0, 80),
        });
      },
    }),
    {
      name: "signal-bookmarks-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      skipHydration: true,
      merge: (persisted, current) => {
        const stored = persisted as { items?: Bookmark[] } | undefined;
        if (!stored?.items?.length) return current;
        return { ...current, items: stored.items };
      },
    },
  ),
);

export function isBookmarked(item: Pick<NewsItem, "id" | "url">): boolean {
  return useBookmarks.getState().items.some((row) => sameStory(row, item));
}

export function hydrateBookmarks(): void {
  if (typeof window === "undefined") return;
  void Promise.resolve(useBookmarks.persist.rehydrate()).finally(() => {
    useBookmarks.setState({ hasHydrated: true });
  });
}
