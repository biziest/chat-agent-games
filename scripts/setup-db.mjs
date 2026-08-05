// Creates the table the community gallery (published games) needs.
// Idempotent — safe to re-run after schema tweaks. Run once after
// connecting a Postgres database (Neon, via the Vercel Marketplace, is the
// easiest option):
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

console.log("Database ready: published_games");
