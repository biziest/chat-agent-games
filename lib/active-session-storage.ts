import { z } from "zod";
import { gameSpecSchema } from "./game";

/**
 * Persists just the one game currently on screen (not every session opened
 * this browser session — that would grow unbounded across days of casual,
 * never-cleared use) so a page reload lands back on it instead of the menu,
 * with its progress intact. Explicitly saved games have their own separate,
 * intentionally-longer-lived storage — see lib/saved-games.ts — this is
 * only "what was I just looking at."
 *
 * The chat id is persisted too and reused when reconstructing the session:
 * chat.agent's history is durably stored server-side keyed by that id, so
 * reconnecting with the same id keeps the model's context (what it built,
 * what's been asked for) even though the browser's own copy of the message
 * list starts empty again after a reload.
 */
const persistedSessionSchema = z.object({
  id: z.string(),
  spec: gameSpecSchema,
  origin: z.enum(["chat", "menu"]),
  progress: z.unknown().optional(),
});

export type PersistedSession = z.infer<typeof persistedSessionSchema>;

const STORAGE_KEY = "chat-agent-games:active-session";

function readFromStorage(): PersistedSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const result = persistedSessionSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// Read once and cached, not re-parsed on every call — `useSyncExternalStore`
// (see workspace.tsx) compares this by reference across renders, and a
// fresh object every call would look like a perpetual change. We only ever
// care about the value as of page load anyway: once workspace.tsx has
// applied it to its own session state, that becomes the source of truth,
// not this cache.
let cache: PersistedSession | null | undefined;

/**
 * The `getSnapshot` half of a `useSyncExternalStore` triple in workspace.tsx
 * — deliberately not a plain function called during a `useState` initializer
 * or `useEffect`. `useState` runs during the server-rendered pass too (which
 * has no localStorage and would always be empty), and a `useEffect` reading
 * this and calling `setState` is exactly what `eslint-plugin-react-hooks`'s
 * `set-state-in-effect` rule flags for what's really a one-time,
 * render-time state adjustment. `useSyncExternalStore` is the one primitive
 * built to hand back a value that legitimately differs between server and
 * client without either problem.
 */
export function getActiveSessionSnapshot(): PersistedSession | null {
  cache ??= readFromStorage();
  return cache;
}

export function getActiveSessionServerSnapshot(): PersistedSession | null {
  return null;
}

// No live updates needed — nothing outside this tab's own writes changes
// this, and workspace.tsx already tracks the live truth in its own session
// state once restored, so an unused (never-firing) subscribe is correct.
export function subscribeActiveSession(): () => void {
  return () => {};
}

/** Pass `null` to clear it (e.g. the player left for the menu). */
export function saveActiveSession(session: PersistedSession | null): void {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}
