import { z } from "zod";
import { GENRES } from "./game";
import type { Genre } from "./game";

/**
 * The public gallery: custom games anyone chose to publish, visible to every
 * visitor (not just their own browser — see lib/saved-games.ts for the
 * per-device equivalent). Backed by Postgres — see lib/db.ts and
 * scripts/setup-db.mjs — since this is the one piece of app state that's
 * genuinely shared across users, unlike everything else here.
 */
export type PublishedGame = {
  id: string;
  title: string;
  genre: Genre;
  html: string;
  authorName: string | null;
  publishedAt: number;
};

export const publishGameInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  genre: z.enum(GENRES),
  html: z.string().min(1),
  // No accounts anywhere in this app, so this is just whatever the
  // publisher typed at the time — not verified, not unique, not a login.
  authorName: z.string().trim().min(1).max(60),
});
export type PublishGameInput = z.infer<typeof publishGameInputSchema>;
