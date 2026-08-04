"use client";

import { GAME_CATALOG, type GameId } from "@/lib/game";

/**
 * Every game the agent knows how to build, as clickable cards. Picking one
 * launches its default settings directly — client-side, no model call — since
 * starting a default game needs no intelligence. Ask in chat instead for
 * anything that needs a decision made (a mark, a difficulty, a color).
 */
export function GameMenu({ onSelect }: { onSelect: (id: GameId) => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-5 grid size-12 grid-cols-2 grid-rows-2 gap-0.5 rounded-xl border border-border bg-surface p-2">
            <span className="rounded-sm bg-accent/25" />
            <span className="rounded-sm bg-white/5" />
            <span className="rounded-sm bg-white/5" />
            <span className="rounded-sm bg-accent/25" />
          </div>
          <h2 className="text-base font-medium tracking-tight">
            Pick a game, or describe one
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Click one below for the default settings, or ask in chat for
            something specific — a difficulty, a color, who goes first.
          </p>
        </div>

        <div className="space-y-2">
          {GAME_CATALOG.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry.id)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-accent/40 hover:bg-surface-raised"
            >
              <p className="text-sm font-medium text-foreground">
                {entry.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {entry.blurb}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
