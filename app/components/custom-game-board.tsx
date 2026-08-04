"use client";

import type { CustomGameSpec } from "@/lib/game";

/**
 * Renders an arbitrary, agent-authored game. Unlike the curated games, there's
 * no shared rules engine here — `game.html` is a complete page the model
 * wrote, run in a sandboxed iframe with scripts allowed but nothing else:
 * no same-origin access, so it can't reach this app's DOM, cookies, or
 * network, regardless of what the generated code tries to do.
 */
export function CustomGameBoard({ game }: { game: CustomGameSpec }) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <header className="text-center">
        <h2 className="text-lg font-medium tracking-tight">{game.title}</h2>
      </header>
      <iframe
        title={game.title}
        srcDoc={game.html}
        sandbox="allow-scripts"
        className="min-h-0 flex-1 rounded-xl border border-border"
      />
    </div>
  );
}
