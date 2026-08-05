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

/** Reads and validates the persisted session — invalid or absent means null. */
export function loadActiveSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
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

/** Pass `null` to clear it (e.g. the player left for the menu). */
export function saveActiveSession(session: PersistedSession | null): void {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}
