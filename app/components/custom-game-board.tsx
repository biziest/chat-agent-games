"use client";

import { useEffect, useState } from "react";
import type { CustomGameSpec } from "@/lib/game";

// Fetched once and reused for every custom game shown this session — the
// bundle (see scripts/bundle-three.mjs) is a static asset, not something that
// changes per game, so there's no reason to refetch it on every switch.
let threeSourcePromise: Promise<string> | null = null;
function loadThreeSource(): Promise<string> {
  threeSourcePromise ??= fetch("/vendor/three.min.js").then((res) => res.text());
  return threeSourcePromise;
}

/**
 * Builds the final iframe document: the vendored three.js bundle inlined
 * first, so a global `THREE` exists before the model's own script runs, then
 * the model-authored page unchanged. Done here at render time rather than
 * baked into the stored spec, so the ~700KB library never touches
 * conversation history or the saved-games localStorage entry — see
 * lib/saved-games.ts.
 */
function withThree(html: string, threeSource: string): string {
  const script = `<script>${threeSource}</script>`;
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
}: {
  game: CustomGameSpec;
  offerSave: boolean;
  onSave: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [threeSource, setThreeSource] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadThreeSource().then((source) => {
      if (!cancelled) setThreeSource(source);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = () => {
    onSave();
    setSaved(true);
  };

  return (
    <div className="flex flex-1 flex-col gap-3 p-6">
      <header className="text-center">
        <h2 className="text-lg font-medium tracking-tight">{game.title}</h2>
      </header>

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
          title={game.title}
          srcDoc={withThree(game.html, threeSource)}
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
