"use server";

import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import {
  getPublishedGameFromDb,
  insertPublishedGame,
  insertReviewToDb,
  listPublishedGamesFromDb,
  listReviewsFromDb,
} from "@/lib/db";
import {
  publishGameInputSchema,
  submitReviewInputSchema,
  type GameReview,
  type PublishedGame,
} from "@/lib/published-games";

/**
 * Creates the durable Session row and triggers the first run, returning the
 * session-scoped public token. Idempotent on (env, chatId), so concurrent calls
 * converge on the same session.
 *
 * This is where per-user authorization would live — the browser never sees the
 * environment's secret key.
 */
export const startChatSession = chat.createStartSessionAction("chat-agent");

/**
 * Mints a fresh session-scoped token for an existing chat. The transport calls
 * this on a 401/403 to refresh.
 */
export async function mintChatAccessToken(chatId: string) {
  return auth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  });
}

/**
 * Publishes a custom game to the shared, public gallery — visible to every
 * visitor, not just this browser (contrast lib/saved-games.ts). Input is
 * revalidated server-side via the same schema the client used, rather than
 * trusted, since this is the one path in the app that writes shared state
 * anyone can read.
 */
export async function publishGame(input: unknown): Promise<PublishedGame> {
  const parsed = publishGameInputSchema.parse(input);
  const id = await insertPublishedGame(parsed);
  const game = await getPublishedGameFromDb(id);
  if (!game) throw new Error("Published game vanished immediately after insert.");
  return game;
}

export async function listPublishedGames(): Promise<PublishedGame[]> {
  return listPublishedGamesFromDb();
}

export async function getPublishedGame(id: string): Promise<PublishedGame | null> {
  return getPublishedGameFromDb(id);
}

export async function listGameReviews(gameId: string): Promise<GameReview[]> {
  return listReviewsFromDb(gameId);
}

/**
 * Records a rating/review. No accounts exist, so there's no server-side way
 * to stop the same visitor rating a game twice — the client only offers the
 * form once per game per browser (see published-game-board.tsx) as a soft
 * courtesy, not an enforced limit.
 */
export async function submitGameRating(input: unknown): Promise<void> {
  const parsed = submitReviewInputSchema.parse(input);
  await insertReviewToDb(parsed);
}
