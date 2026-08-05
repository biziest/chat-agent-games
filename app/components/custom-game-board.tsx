"use client";

import { useEffect, useId, useRef, useState } from "react";
import { publishGame, unpublishGame } from "@/app/actions";
import { TypeToConfirmModal } from "@/app/components/type-to-confirm-modal";
import type { CustomGameSpec } from "@/lib/game";
import { PROGRESS_MESSAGE_TYPE } from "@/lib/custom-game-protocol";
import { markPublishedByMe, unmarkPublishedByMe } from "@/lib/published-game-tracking";
import { buildGameSrcDoc, loadThreeSource } from "@/lib/three-runtime";

// Remembered across publishes on this browser so returning players don't
// have to retype it every time — not an account, just a convenience.
const AUTHOR_NAME_KEY = "chat-agent-games:author-name";

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
  const [showPublishPrompt, setShowPublishPrompt] = useState(false);
  const [showUnpublishPrompt, setShowUnpublishPrompt] = useState(false);
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "published" | "error">(
    "idle",
  );
  const [publishedId, setPublishedId] = useState<string | null>(null);
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
  const handlePublish = async (authorName: string) => {
    setShowPublishPrompt(false);
    setPublishState("publishing");
    try {
      const published = await publishGame({
        title: game.title,
        genre: game.genre,
        html: game.html,
        authorName,
      });
      window.localStorage.setItem(AUTHOR_NAME_KEY, authorName);
      markPublishedByMe(published.id);
      setPublishedId(published.id);
      setPublishState("published");
    } catch {
      setPublishState("error");
    }
  };

  const handleUnpublish = async () => {
    if (!publishedId) return;
    setShowUnpublishPrompt(false);
    await unpublishGame(publishedId);
    unmarkPublishedByMe(publishedId);
    setPublishedId(null);
    setPublishState("idle");
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
          <>
            <span className="text-accent">Published — everyone can play it ✓</span>
            <button
              type="button"
              onClick={() => setShowUnpublishPrompt(true)}
              className="text-xs text-muted underline decoration-red-400/40 underline-offset-2 hover:text-red-300 hover:decoration-red-300"
            >
              Unpublish
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowPublishPrompt(true)}
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

      {showPublishPrompt ? (
        <PublishPrompt
          onCancel={() => setShowPublishPrompt(false)}
          onConfirm={(name) => void handlePublish(name)}
        />
      ) : null}

      {showUnpublishPrompt ? (
        <TypeToConfirmModal
          title={`Unpublish "${game.title}"?`}
          description="It'll be removed from the community gallery for everyone. This can't be undone. Type yes to confirm."
          confirmLabel="Unpublish"
          onCancel={() => setShowUnpublishPrompt(false)}
          onConfirm={() => void handleUnpublish()}
        />
      ) : null}
    </div>
  );
}

/**
 * Asks for a display name before publishing — the game's publish date is
 * always just "now" (stamped server-side, see lib/db.ts), not something the
 * player picks.
 */
function PublishPrompt({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (authorName: string) => void;
}) {
  const [name, setName] = useState(
    () => (typeof window !== "undefined" && window.localStorage.getItem(AUTHOR_NAME_KEY)) || "",
  );
  const inputId = useId();
  const trimmed = name.trim();

  const confirm = () => {
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${inputId}-title`}
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-border bg-surface p-5"
      >
        <h3 id={`${inputId}-title`} className="text-sm font-medium text-foreground">
          Publish this game?
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Everyone will be able to find and play it. What name should show as the creator?
        </p>
        <input
          id={inputId}
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") confirm();
            if (event.key === "Escape") onCancel();
          }}
          placeholder="Your name"
          maxLength={60}
          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/40"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!trimmed}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
