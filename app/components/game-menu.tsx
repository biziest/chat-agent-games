"use client";

import { useId, useState } from "react";
import { GAME_CATALOG, GENRES, type CatalogGameId, type Genre } from "@/lib/game";
import type { SavedGame } from "@/lib/saved-games";

type Props = {
  onSelect: (id: CatalogGameId) => void;
  savedGames: SavedGame[];
  onLaunchSaved: (saved: SavedGame) => void;
  onRemoveSaved: (id: string) => void;
};

/**
 * Every game on screen — the two curated ones plus anything saved from chat —
 * grouped into genre folders instead of one flat list. Picking a curated game
 * launches its default settings directly, client-side, no model call; picking
 * a saved game replays its stored spec the same way. Anything else (a
 * specific difficulty, or a game not on this list at all) goes through chat —
 * see `createCustomGame` in trigger/chat.ts for how it gets its genre.
 */
export function GameMenu({
  onSelect,
  savedGames,
  onLaunchSaved,
  onRemoveSaved,
}: Props) {
  const [pendingDelete, setPendingDelete] = useState<SavedGame | null>(null);

  const folders = GENRES.map((genre) => ({
    genre,
    catalogEntries: GAME_CATALOG.filter((entry) => entry.genre === genre),
    savedEntries: savedGames.filter((saved) => saved.spec.genre === genre),
  })).filter((folder) => folder.catalogEntries.length + folder.savedEntries.length > 0);

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-10">
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
          {folders.map((folder) => (
            <GenreFolder
              key={folder.genre}
              genre={folder.genre}
              catalogEntries={folder.catalogEntries}
              savedEntries={folder.savedEntries}
              onSelect={onSelect}
              onLaunchSaved={onLaunchSaved}
              onRequestRemove={setPendingDelete}
            />
          ))}
        </div>
      </div>

      {pendingDelete ? (
        <ConfirmDeleteModal
          game={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            onRemoveSaved(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Deleting a saved game can't be undone (there's nowhere else it's kept —
 * see lib/saved-games.ts), so this asks for a typed "yes" rather than just a
 * click, the way a misplaced tap on the small × button next to it wouldn't.
 */
function ConfirmDeleteModal({
  game,
  onCancel,
  onConfirm,
}: {
  game: SavedGame;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const inputId = useId();
  const confirmed = confirmText.trim().toLowerCase() === "yes";

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
          Delete &ldquo;{game.spec.title}&rdquo;?
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          This can&rsquo;t be undone. Type <span className="text-foreground">yes</span> to
          confirm.
        </p>
        <input
          id={inputId}
          autoFocus
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && confirmed) onConfirm();
            if (event.key === "Escape") onCancel();
          }}
          placeholder="yes"
          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-red-500/40"
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
            onClick={onConfirm}
            disabled={!confirmed}
            className="rounded-lg bg-red-500/90 px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function GenreFolder({
  genre,
  catalogEntries,
  savedEntries,
  onSelect,
  onLaunchSaved,
  onRequestRemove,
}: {
  genre: Genre;
  catalogEntries: (typeof GAME_CATALOG)[number][];
  savedEntries: SavedGame[];
  onSelect: (id: CatalogGameId) => void;
  onLaunchSaved: (saved: SavedGame) => void;
  onRequestRemove: (saved: SavedGame) => void;
}) {
  const count = catalogEntries.length + savedEntries.length;

  return (
    <details
      open
      className="group rounded-xl border border-border bg-surface open:bg-surface"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground">
        <span className="flex items-center gap-2">
          <span className="text-muted transition-transform group-open:rotate-90">
            ▸
          </span>
          {genre}
        </span>
        <span className="text-xs text-muted">{count}</span>
      </summary>

      <div className="space-y-2 border-t border-border p-2.5">
        {catalogEntries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelect(entry.id)}
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-surface-raised"
          >
            <p className="text-sm font-medium text-foreground">{entry.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {entry.blurb}
            </p>
          </button>
        ))}

        {savedEntries.map((saved) => (
          <div key={saved.id} className="flex items-stretch gap-1.5">
            <button
              type="button"
              onClick={() => onLaunchSaved(saved)}
              className="flex-1 rounded-lg border border-border bg-background px-3.5 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-surface-raised"
            >
              <p className="text-sm font-medium text-foreground">
                {saved.spec.title}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onRequestRemove(saved)}
              aria-label={`Remove ${saved.spec.title}`}
              className="rounded-lg border border-border px-2.5 text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}
