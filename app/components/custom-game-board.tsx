"use client";

import { useEffect, useRef, useState } from "react";
import { publishGame } from "@/app/actions";
import type { CustomGameSpec } from "@/lib/game";
import { PROGRESS_MESSAGE_TYPE } from "@/lib/custom-game-protocol";
import { buildGameSrcDoc, loadThreeSource } from "@/lib/three-runtime";

/**
 * Renders an arbitrary, agent-authored game. Unlike the curated games, there's
 * no shared rules engine here — `game.html` is a complete page the model
 * wrote, run in a sandboxed iframe with scripts allowed but nothing else:
 * no same-origin access, so it can't reach this app's DOM, cookies, or
 * network, regardless of what the generated code tries to do.
 */
export function CustomGameBoard({
  game,
  offerSave,
  onSave,
  initialProgress,
  onProgressChange,
  onIframeWindowChange,
}: {
  game: CustomGameSpec;
  offerSave: boolean;
  onSave: () => void;
  initialProgress?: unknown;
  onProgressChange: (progress: unknown) => void;
  // Reports this game's iframe window up to workspace.tsx (null once gone)
  // so it can ask the game to flush its current state right before
  // navigating away — see FLUSH_PROGRESS_WAIT_MS and handleExitGame there.
  // Optional only for callers (tests, storybook-style usage) that don't
  // need that.
  onIframeWindowChange?: (win: Window | null) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "published" | "error">(
    "idle",
  );
  const [threeSource, setThreeSource] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Captured once at mount — the *live* prop changes every time this game's
  // own progress gets reported (see the message listener below), and
  // re-embedding it into `srcDoc` on every change would reload the iframe
  // (wiping its state) each time it tries to save that same state.
  const [capturedProgress] = useState(() => initialProgress ?? null);

  useEffect(() => {
    let cancelled = false;
    void loadThreeSource().then((source) => {
      if (!cancelled) setThreeSource(source);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The iframe only actually exists once `threeSource` has loaded (see the
  // conditional render below), so this only has something to report once
  // that's true — and needs `threeSource` as a dependency to re-run then.
  useEffect(() => {
    if (!onIframeWindowChange || !threeSource) return;
    onIframeWindowChange(iframeRef.current?.contentWindow ?? null);
    return () => onIframeWindowChange(null);
  }, [onIframeWindowChange, threeSource]);

  // The sandboxed iframe has no other channel back to the app, so a custom
  // game reports its own resumable state via postMessage — see the
  // save/restore contract in trigger/chat.ts's system prompt. Checking
  // `event.source` against this iframe's own window (not just the message
  // shape) is what makes this safe to trust despite `sandbox="allow-scripts"`
  // giving the content an opaque, unverifiable origin.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data: unknown = event.data;
      if (
        !data ||
        typeof data !== "object" ||
        (data as { type?: unknown }).type !== PROGRESS_MESSAGE_TYPE
      ) {
        return;
      }
      onProgressChange((data as { progress: unknown }).progress);
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onProgressChange]);

  const handleSave = () => {
    onSave();
    setSaved(true);
  };

  // Calls the server action directly rather than threading a prop through
  // game-pane.tsx/workspace.tsx — publishing is a network call with its own
  // loading/error states this component already needs to own, and Next.js
  // server actions are safe to call straight from a client component.
  const handlePublish = async () => {
    setPublishState("publishing");
    try {
      await publishGame({ title: game.title, genre: game.genre, html: game.html });
      setPublishState("published");
    } catch {
      setPublishState("error");
    }
  };

  // A rough but reliable signal: the only way this HTML could restore state
  // is by reading `window.__initialProgress`, so if that string isn't in
  // there at all, this game predates the save/restore contract in
  // trigger/chat.ts (or was built before that instruction existed) and won't
  // resume no matter what gets injected into `srcDoc`. Asking the model to
  // add it (in this game's own chat) makes it regenerate the HTML with the
  // contract included, same as any other edit.
  const supportsProgress = game.html.includes("__initialProgress");

  return (
    <div className="flex flex-1 flex-col gap-3 p-6">
      <header className="text-center">
        <h2 className="text-lg font-medium tracking-tight">{game.title}</h2>
      </header>

      {!supportsProgress ? (
        <p className="text-center text-xs text-muted">
          This game was built before progress-saving existed — ask its chat to
          &ldquo;add save and resume support&rdquo; to fix that.
        </p>
      ) : null}

      {/* There's no channel back from the sandboxed iframe, so this can't
          detect "you just finished playing" — it's offered once, right
          after generation, and the player decides when to act on it. */}
      {offerSave && !dismissed ? (
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm">
          {saved ? (
            <span className="text-accent">Saved to your library ✓</span>
          ) : (
            <>
              <span className="text-muted">Want to keep this game?</span>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90"
              >
                Save to library
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="text-xs text-muted transition-colors hover:text-foreground"
              >
                Not now
              </button>
            </>
          )}
        </div>
      ) : null}

      <div className="flex items-center justify-center gap-3 text-sm">
        {publishState === "published" ? (
          <span className="text-accent">Published — everyone can play it ✓</span>
        ) : (
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={publishState === "publishing"}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publishState === "publishing" ? "Publishing…" : "🌐 Publish for everyone"}
          </button>
        )}
        {publishState === "error" ? (
          <span className="text-xs text-red-300">Couldn&rsquo;t publish — try again.</span>
        ) : null}
      </div>

      {threeSource ? (
        <iframe
          ref={iframeRef}
          title={game.title}
          srcDoc={buildGameSrcDoc(game.html, threeSource, capturedProgress)}
          sandbox="allow-scripts"
          className="min-h-0 flex-1 rounded-xl border border-border"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border text-sm text-muted">
          Loading graphics engine…
        </div>
      )}
    </div>
  );
}
