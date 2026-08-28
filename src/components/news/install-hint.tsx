import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "signal-pwa-install-dismissed-v1";

type PromptEvent = Event & {
  prompt: () => Promise<void>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone))
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallHint() {
  const [visible, setVisible] = useState(false);
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      return;
    }
    setVisible(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as PromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore quota */
    }
    setVisible(false);
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    setPromptEvent(null);
    dismiss();
  };

  return (
    <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {promptEvent
          ? "ホーム画面に追加すると、アプリとして開けます。"
          : isIos()
            ? "共有から「ホーム画面に追加」で、アプリとして開けます。"
            : "ブラウザのメニューからホーム画面に追加すると、アプリとして開けます。"}
      </p>
      <div className="flex items-center gap-3">
        {promptEvent ? (
          <button
            type="button"
            onClick={() => void install()}
            className="inline-flex h-11 items-center gap-1.5 text-xs font-medium text-foreground"
          >
            <Download className="size-3.5" />
            追加する
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className={cn("h-11 text-xs font-medium text-muted-foreground hover:text-foreground")}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
