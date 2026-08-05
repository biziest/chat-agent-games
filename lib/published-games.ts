import { z } from "zod";
import { GENRES, type Genre } from "./game";

/**
 * The public gallery: custom games anyone chose to publish, visible to every
 * visitor (not just their own browser — see lib/saved-games.ts for the
 * per-device equivalent). Backed by Postgres — see lib/db.ts and
 * scripts/setup-db.mjs — since this is the one piece of app state that's
 * genuinely shared across users, unlike everything else here.
 *
 * No accounts exist anywhere in this app, so publishing and rating are both
 * anonymous: a review is just a rating, an optional name, and an optional
 * comment, with no identity behind it. "One rating per game per browser" is
 * enforced client-side only (see the localStorage check in
 * published-game-board.tsx) — a soft courtesy, not a security boundary.
 */
export type PublishedGame = {
  id: string;
  title: string;
  genre: Genre;
  html: string;
  publishedAt: number;
  ratingCount: number;
  ratingAverage: number | null;
};

export type GameReview = {
  id: string;
  rating: number;
  reviewerName: string | null;
  comment: string | null;
  createdAt: number;
};

export const publishGameInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  genre: z.enum(GENRES),
  html: z.string().min(1),
});
export type PublishGameInput = z.infer<typeof publishGameInputSchema>;

export const submitReviewInputSchema = z.object({
  gameId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  reviewerName: z.string().trim().max(60).optional(),
  comment: z.string().trim().max(2000).optional(),
});
export type SubmitReviewInput = z.infer<typeof submitReviewInputSchema>;
