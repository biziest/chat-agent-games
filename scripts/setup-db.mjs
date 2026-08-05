// Creates the tables the community gallery (published games + reviews)
// needs. Idempotent — safe to re-run after schema tweaks. Run once after
// connecting a Postgres database (Vercel Postgres, from the project's
// Storage tab, is the easiest option):
//
//   node --env-file=.env scripts/setup-db.mjs
//
// Needs POSTGRES_URL in the environment — Vercel injects this
// automatically for deployed environments; for local runs, pull it with
// `vercel env pull` or copy it into .env yourself.

import { sql } from "@vercel/postgres";

await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;

await sql`
  CREATE TABLE IF NOT EXISTS published_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    genre TEXT NOT NULL,
    html TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

await sql`
  CREATE TABLE IF NOT EXISTS game_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES published_games(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    reviewer_name TEXT,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

await sql`CREATE INDEX IF NOT EXISTS game_reviews_game_id_idx ON game_reviews (game_id);`;

console.log("Database ready: published_games, game_reviews");
