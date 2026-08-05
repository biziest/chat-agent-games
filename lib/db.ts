import "server-only";
import { sql } from "@vercel/postgres";
import type { Genre } from "./game";
import type { GameReview, PublishedGame } from "./published-games";

/**
 * Thin query layer over the `published_games` / `game_reviews` tables — see
 * scripts/setup-db.mjs for the schema these assume. Kept separate from
 * app/actions.ts so the "use server" action boundary stays about
 * validation/authorization, not SQL.
 */

type PublishedGameRow = {
  id: string;
  title: string;
  genre: string;
  html: string;
  published_at: number;
  rating_count: number;
  rating_average: number | null;
};

function toPublishedGame(row: PublishedGameRow): PublishedGame {
  return {
    id: row.id,
    title: row.title,
    genre: row.genre as Genre,
    html: row.html,
    publishedAt: Number(row.published_at),
    ratingCount: Number(row.rating_count),
    ratingAverage: row.rating_average === null ? null : Number(row.rating_average),
  };
}

// `@vercel/postgres`'s `sql` is a tagged-template only — no fragment
// composition helper — so the shared SELECT/JOIN is just duplicated below
// rather than built from a shared string (which would need string
// concatenation into the query text, defeating the point of the tag's
// built-in parameterization).

export async function insertPublishedGame(input: {
  title: string;
  genre: Genre;
  html: string;
}): Promise<string> {
  const result = await sql<{ id: string }>`
    INSERT INTO published_games (title, genre, html)
    VALUES (${input.title}, ${input.genre}, ${input.html})
    RETURNING id;
  `;
  return result.rows[0].id;
}

export async function listPublishedGamesFromDb(): Promise<PublishedGame[]> {
  const result = await sql<PublishedGameRow>`
    SELECT
      g.id,
      g.title,
      g.genre,
      g.html,
      extract(epoch from g.published_at) * 1000 as published_at,
      count(r.id)::int as rating_count,
      avg(r.rating)::float8 as rating_average
    FROM published_games g
    LEFT JOIN game_reviews r ON r.game_id = g.id
    GROUP BY g.id
    ORDER BY g.published_at DESC;
  `;
  return result.rows.map(toPublishedGame);
}

export async function getPublishedGameFromDb(id: string): Promise<PublishedGame | null> {
  const result = await sql<PublishedGameRow>`
    SELECT
      g.id,
      g.title,
      g.genre,
      g.html,
      extract(epoch from g.published_at) * 1000 as published_at,
      count(r.id)::int as rating_count,
      avg(r.rating)::float8 as rating_average
    FROM published_games g
    LEFT JOIN game_reviews r ON r.game_id = g.id
    WHERE g.id = ${id}
    GROUP BY g.id;
  `;
  return result.rows[0] ? toPublishedGame(result.rows[0]) : null;
}

export async function listReviewsFromDb(gameId: string): Promise<GameReview[]> {
  const result = await sql<{
    id: string;
    rating: number;
    reviewer_name: string | null;
    comment: string | null;
    created_at: number;
  }>`
    SELECT id, rating, reviewer_name, comment, extract(epoch from created_at) * 1000 as created_at
    FROM game_reviews
    WHERE game_id = ${gameId}
    ORDER BY created_at DESC;
  `;
  return result.rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    reviewerName: row.reviewer_name,
    comment: row.comment,
    createdAt: Number(row.created_at),
  }));
}

export async function insertReviewToDb(input: {
  gameId: string;
  rating: number;
  reviewerName?: string;
  comment?: string;
}): Promise<void> {
  await sql`
    INSERT INTO game_reviews (game_id, rating, reviewer_name, comment)
    VALUES (
      ${input.gameId},
      ${input.rating},
      ${input.reviewerName ?? null},
      ${input.comment ?? null}
    );
  `;
}
