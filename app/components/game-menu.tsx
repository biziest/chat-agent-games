"use client";

import { useEffect, useId, useState } from "react";
import { listPublishedGames } from "@/app/actions";
import { GAME_CATALOG, GENRES, type CatalogGameId, type Genre } from "@/lib/game";
import type { PublishedGame } from "@/lib/published-games";
import type { SavedGame } from "@/lib/saved-games";

type Props = {
  onSelect: (id: CatalogGameId) => void;
  savedGames: SavedGame[];
  onLaunchSaved: (saved: SavedGame) => void;
  onRemoveSaved: (id: string) => void;
  onSelectPublished: (game: PublishedGame) => void;
};

/**
 * Every game on screen — the two curated ones plus anything saved from chat —
 * grouped into genre folders instead of one flat list. Picking a curated game
 * launches its default settings directly, client-side, no model call; picking
 * a saved game replays its stored spec the same way. Anything else (a
 * specific difficulty, or a game not on this list at all) goes through chat —
 * see `createCustomGame` in trigger/chat.ts for how it gets its genre.
 *
 * A second tab lists what anyone has published to the shared gallery — see
 * lib/published-games.ts and app/actions.ts — separate from "My Games"
 * since it's the one place in this app showing data from other visitors.
 */
export function GameMenu({
  onSelect,
  savedGames,
  onLaunchSaved,
  onRemoveSaved,
  onSelectPublished,
}: Props) {
  const [pendingDelete, setPendingDelete] = useState<SavedGame | null>(null);
  const [tab, setTab] = useState<"mine" | "community">("mine");

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

        <div className="mb-4 flex gap-1 rounded-lg border border-border bg-surface p-1">
          <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
            My games
          </TabButton>
          <TabButton active={tab === "community"} onClick={() => setTab("community")}>
            🌐 Community
          </TabButton>
        </div>

        {tab === "mine" ? (
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
        ) : (
          <CommunityList onSelect={onSelectPublished} />
        )}
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-surface-raised text-foreground" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function CommunityList({ onSelect }: { onSelect: (game: PublishedGame) => void }) {
  const [games, setGames] = useState<PublishedGame[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPublishedGames()
      .then((fetched) => {
        if (!cancelled) setGames(fetched);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return <p className="text-center text-sm text-muted">Couldn&rsquo;t load published games.</p>;
  }
  if (!games) {
    return <p className="text-center text-sm text-muted">Loading…</p>;
  }
  if (games.length === 0) {
    return (
      <p className="text-center text-sm text-muted">
        Nobody&rsquo;s published a game yet — build one and be the first.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {games.map((game) => (
        <button
          key={game.id}
          type="button"
          onClick={() => onSelect(game)}
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-surface-raised"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{game.title}</p>
            <span className="text-[11px] text-muted">{game.genre}</span>
          </div>
        </button>
      ))}
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
