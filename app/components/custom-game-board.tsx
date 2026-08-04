"use client";

import { useState } from "react";
import type { CustomGameSpec } from "@/lib/game";

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

      <iframe
        title={game.title}
        srcDoc={game.html}
        sandbox="allow-scripts"
        className="min-h-0 flex-1 rounded-xl border border-border"
      />
    </div>
  );
}
