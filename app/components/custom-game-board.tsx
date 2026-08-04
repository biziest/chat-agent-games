"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomGameSpec } from "@/lib/game";

// Fetched once and reused for every custom game shown this session — the
// bundle (see scripts/bundle-three.mjs) is a static asset, not something that
// changes per game, so there's no reason to refetch it on every switch.
let threeSourcePromise: Promise<string> | null = null;
function loadThreeSource(): Promise<string> {
  threeSourcePromise ??= fetch("/vendor/three.min.js").then((res) => res.text());
  return threeSourcePromise;
}

const PROGRESS_MESSAGE_TYPE = "chat-agent-games:progress";

/** Escapes `<` so a JSON value can't break out of its enclosing <script> tag. */
function embedJson(value: unknown): string {
  return JSON.stringify(value ?? null).replace(/</g, "\\u003c");
}

/**
 * Builds the final iframe document: a small runtime script inlined first —
 * the vendored three.js bundle (so a global `THREE` exists before the
 * model's own script runs) plus `window.__initialProgress` (the resume state
 * from a previous visit, or `null` for a fresh game; see the system prompt in
 * trigger/chat.ts for the save/restore contract the model's script follows)
 * — then the model-authored page unchanged. Done here at render time rather
 * than baked into the stored spec, so neither the three.js bundle nor a
 * game's progress touches conversation history or the saved-games
 * localStorage entry itself — see lib/saved-games.ts.
 */
function buildSrcDoc(html: string, threeSource: string, initialProgress: unknown): string {
  const script = `<script>window.__initialProgress=${embedJson(initialProgress)};${threeSource}</script>`;
  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch) {
    const index = headMatch.index + headMatch[0].length;
    return html.slice(0, index) + script + html.slice(index);
  }
  return script + html;
}

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
}: {
  game: CustomGameSpec;
  offerSave: boolean;
  onSave: () => void;
  initialProgress?: unknown;
  onProgressChange: (progress: unknown) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(false);
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

      {threeSource ? (
        <iframe
          ref={iframeRef}
          title={game.title}
          srcDoc={buildSrcDoc(game.html, threeSource, capturedProgress)}
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
