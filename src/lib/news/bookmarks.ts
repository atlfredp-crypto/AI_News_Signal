import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NewsItem } from "./types";

export type Bookmark = NewsItem & { savedAt: string };

type BookmarkState = {
  items: Bookmark[];
  toggle: (item: NewsItem) => void;
};

export const useBookmarks = create<BookmarkState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (item) => {
        const current = get().items;
        const exists = current.some((row) => row.id === item.id);
        set({
          items: exists
            ? current.filter((row) => row.id !== item.id)
            : [
                { ...item, savedAt: new Date().toISOString() },
                ...current,
              ].slice(0, 80),
        });
      },
    }),
    { name: "signal-bookmarks-v1" },
  ),
);
