/**
 * postMessage protocol between the app and a custom (agent-authored) game's
 * sandboxed iframe — shared between the frontend (custom-game-board.tsx)
 * and the system prompt (trigger/chat.ts) so the two can't drift out of
 * sync with each other.
 *
 * - `PROGRESS`: iframe → app. Reports the game's current resumable state,
 *   sent whenever something worth resuming from changes, and again
 *   immediately in response to `REQUEST_PROGRESS`.
 * - `REQUEST_PROGRESS`: app → iframe. Sent right before the game is about
 *   to be navigated away from (leaving for the menu, picking another game),
 *   asking it to report its *current* state one last time rather than
 *   whatever it last happened to report — a game that only saves at
 *   sparse checkpoints (not every frame) would otherwise lose whatever
 *   happened since the last one.
 */
export const PROGRESS_MESSAGE_TYPE = "chat-agent-games:progress";
export const REQUEST_PROGRESS_MESSAGE_TYPE = "chat-agent-games:request-progress";

/**
 * How long the app waits, after asking a custom game to flush its current
 * state, before actually completing the navigation away from it. Long
 * enough for a same-document postMessage round trip, short enough that
 * leaving doesn't feel laggy.
 */
export const FLUSH_PROGRESS_WAIT_MS = 150;
