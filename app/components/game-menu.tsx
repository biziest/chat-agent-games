"use client";

import { GAME_CATALOG, type CatalogGameId } from "@/lib/game";

/**
 * The two curated games, as clickable cards — not the full catalog of what's
 * buildable. Picking one launches its default settings directly, client-side,
 * no model call, since starting a default game needs no intelligence.
 * Anything else (a specific difficulty, or a game that isn't on this list at
 * all) goes through chat, where the agent can also write an arbitrary game
 * from scratch — see `createCustomGame` in trigger/chat.ts.
 */
export function GameMenu({ onSelect }: { onSelect: (id: CatalogGameId) => void }) {
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
            Click one below for the default settings, or describe any game in
            chat — from a quick tweak to something completely different.
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
