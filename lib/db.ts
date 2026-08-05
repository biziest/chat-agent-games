import "server-only";
import { sql } from "@vercel/postgres";
import type { Genre } from "./game";
import type { PublishedGame } from "./published-games";

/**
 * Thin query layer over the `published_games` table — see
 * scripts/setup-db.mjs for the schema this assumes. Kept separate from
 * app/actions.ts so the "use server" action boundary stays about
 * validation/authorization, not SQL.
 */

type PublishedGameRow = {
  id: string;
  title: string;
  genre: string;
  html: string;
  published_at: number;
};

function toPublishedGame(row: PublishedGameRow): PublishedGame {
  return {
    id: row.id,
    title: row.title,
    genre: row.genre as Genre,
    html: row.html,
    publishedAt: Number(row.published_at),
  };
}

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
    SELECT id, title, genre, html, extract(epoch from published_at) * 1000 as published_at
    FROM published_games
    ORDER BY published_at DESC;
  `;
  return result.rows.map(toPublishedGame);
}

export async function getPublishedGameFromDb(id: string): Promise<PublishedGame | null> {
  const result = await sql<PublishedGameRow>`
    SELECT id, title, genre, html, extract(epoch from published_at) * 1000 as published_at
    FROM published_games
    WHERE id = ${id};
  `;
  return result.rows[0] ? toPublishedGame(result.rows[0]) : null;
}
