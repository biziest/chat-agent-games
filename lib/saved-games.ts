import { z } from "zod";
import { customGameSpecSchema, type CustomGameSpec } from "./game";

/**
 * The user's kept custom games — the ones they chose to save after a fresh
 * generation, via the prompt in `custom-game-board.tsx`. Curated games
 * (noughts and crosses, chess) don't go through this: they're always
 * available from `GAME_CATALOG`, nothing to save.
 *
 * Persisted to localStorage, not a database — this app has no accounts or
 * auth, so "remember this on my device" is the right-sized scope, not a
 * backend. Per-browser, not synced across devices.
 *
 * Exposed as a small external store (subscribe/getSnapshot/getServerSnapshot)
 * rather than a plain load function read in a `useEffect`: reading
 * localStorage only after mount and `setState`-ing the result is exactly the
 * pattern `react-hooks/set-state-in-effect` flags, and `useSyncExternalStore`
 * is the sanctioned tool for "sync from something outside React, give the
 * server a safe default" — it guarantees the SSR/first-paint snapshot ([])
 * matches what was actually prerendered, then syncs to the real value
 * without a hydration mismatch.
 */
export type SavedGame = {
  id: string;
  spec: CustomGameSpec;
  savedAt: number;
  // Opaque, game-defined resume state — a curated game's move history, or
  // whatever a custom game last reported via its progress protocol (see
  // custom-game-board.tsx). Unvalidated beyond "is it JSON": its shape is
  // defined by whichever board component owns it, not by this module.
  progress?: unknown;
};

const savedGameSchema = z.object({
  id: z.string(),
  spec: customGameSpecSchema,
  savedAt: z.number(),
  progress: z.unknown().optional(),
});

const STORAGE_KEY = "chat-agent-games:saved-games";

const EMPTY: SavedGame[] = [];
let cache: SavedGame[] | null = null;
const listeners = new Set<() => void>();

/**
 * Reads and validates from localStorage rather than trusting it blindly —
 * the schema can change between app versions (it already has once, adding
 * `genre`), and a stale or hand-edited entry shouldn't crash the menu. Invalid
 * entries are silently dropped rather than discarding the whole list.
 */
function readFromStorage(): SavedGame[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed
      .map((entry) => savedGameSchema.safeParse(entry))
      .filter((result) => result.success)
      .map((result) => result.data);
  } catch {
    return EMPTY;
  }
}

export function subscribeSavedGames(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getSavedGamesSnapshot(): SavedGame[] {
  cache ??= readFromStorage();
  return cache;
}

export function getSavedGamesServerSnapshot(): SavedGame[] {
  return EMPTY;
}

/** Writes through to localStorage and notifies every subscribed component. */
export function writeSavedGames(games: SavedGame[]): void {
  cache = games;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  for (const listener of listeners) listener();
}
