import { z } from "zod";

/**
 * The contract between the agent and the UI. The agent authors one of these;
 * the browser renders it and owns all gameplay state from there.
 *
 * Lives at the repo root so both `trigger/` and `app/` can import it without
 * either pulling in the other's dependencies.
 *
 * Adding a game: add a `<kind>SpecSchema`, a `create<Kind>InputSchema` (what
 * the model fills in — keep every field optional so a bare "make chess" is a
 * valid call), a `normalize<Kind>Spec` that fills defaults, and a
 * `GAME_CATALOG` entry. Then a tool in `trigger/chat.ts` and a board
 * component in `app/components/`.
 */

// ---------- Noughts & crosses ----------

export const noughtsAndCrossesSpecSchema = z.object({
  kind: z.literal("noughts-and-crosses"),
  title: z.string(),
  playerMark: z.enum(["X", "O"]),
  difficulty: z.enum(["easy", "medium", "perfect"]),
  firstMove: z.enum(["player", "computer"]),
});

export type NoughtsAndCrossesSpec = z.infer<typeof noughtsAndCrossesSpecSchema>;

export const createNoughtsAndCrossesInputSchema = z.object({
  title: z
    .string()
    .optional()
    .describe("Short display name for the game, e.g. 'Noughts & Crosses'."),
  playerMark: z
    .enum(["X", "O"])
    .optional()
    .describe("Which mark the human plays. Defaults to X."),
  difficulty: z
    .enum(["easy", "medium", "perfect"])
    .optional()
    .describe(
      "Computer strength. 'easy' plays at random, 'medium' mixes good and random moves, 'perfect' is unbeatable.",
    ),
  firstMove: z
    .enum(["player", "computer"])
    .optional()
    .describe("Who moves first. Defaults to the player."),
});

export type CreateNoughtsAndCrossesInput = z.infer<
  typeof createNoughtsAndCrossesInputSchema
>;

export function normalizeNoughtsAndCrossesSpec(
  input: CreateNoughtsAndCrossesInput = {},
): NoughtsAndCrossesSpec {
  return {
    kind: "noughts-and-crosses",
    title: input.title?.trim() || "Noughts & Crosses",
    playerMark: input.playerMark ?? "X",
    difficulty: input.difficulty ?? "medium",
    firstMove: input.firstMove ?? "player",
  };
}

// ---------- Chess ----------

export const chessSpecSchema = z.object({
  kind: z.literal("chess"),
  title: z.string(),
  playerColor: z.enum(["white", "black"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export type ChessSpec = z.infer<typeof chessSpecSchema>;

export const createChessInputSchema = z.object({
  title: z
    .string()
    .optional()
    .describe("Short display name for the game, e.g. 'Chess'."),
  playerColor: z
    .enum(["white", "black"])
    .optional()
    .describe("Which side the human plays. Defaults to white."),
  difficulty: z
    .enum(["easy", "medium", "hard"])
    .optional()
    .describe(
      "Computer strength. 'easy' plays randomly, 'medium' looks a couple of moves ahead, 'hard' looks further and rarely blunders material — strong, but not unbeatable the way perfect play in noughts and crosses is.",
    ),
});

export type CreateChessInput = z.infer<typeof createChessInputSchema>;

export function normalizeChessSpec(input: CreateChessInput = {}): ChessSpec {
  return {
    kind: "chess",
    title: input.title?.trim() || "Chess",
    playerColor: input.playerColor ?? "white",
    difficulty: input.difficulty ?? "medium",
  };
}

// ---------- Custom (arbitrary, agent-authored) games ----------

/**
 * The escape valve for anything that isn't one of the curated games above: the
 * agent writes an actual, complete HTML page — its own <style> and <script>,
 * fully self-contained — and the frontend renders it in a sandboxed iframe. No
 * difficulty or turn-order fields here; whatever settings a custom game needs
 * are the agent's problem to build into the page itself.
 */
export const customGameSpecSchema = z.object({
  kind: z.literal("custom"),
  title: z.string(),
  html: z.string(),
});

export type CustomGameSpec = z.infer<typeof customGameSpecSchema>;

export const createCustomGameInputSchema = z.object({
  title: z
    .string()
    .optional()
    .describe("Short display name for the game."),
  html: z
    .string()
    .describe(
      "A complete, self-contained HTML document implementing the game — <style> and <script> inline in the same document. No external scripts, stylesheets, fonts, or images: it runs in a sandboxed iframe with no network access, so anything external silently fails to load.",
    ),
});

export type CreateCustomGameInput = z.infer<typeof createCustomGameInputSchema>;

export function normalizeCustomGameSpec(
  input: CreateCustomGameInput,
): CustomGameSpec {
  return {
    kind: "custom",
    title: input.title?.trim() || "Custom Game",
    html: input.html,
  };
}

// ---------- Union + catalog ----------

export const gameSpecSchema = z.discriminatedUnion("kind", [
  noughtsAndCrossesSpecSchema,
  chessSpecSchema,
  customGameSpecSchema,
]);

export type GameSpec = z.infer<typeof gameSpecSchema>;

/**
 * Names of the tools that create/replace a game — one per kind, declared in
 * `trigger/chat.ts`. Shared so the frontend can recognize a game-creating tool
 * call generically instead of hardcoding the list in two places.
 */
export const GAME_TOOL_NAMES: ReadonlySet<string> = new Set([
  "createNoughtsAndCrosses",
  "createChess",
  "createCustomGame",
]);

/**
 * The games with a menu entry and a sensible default spec — deliberately
 * narrower than `GameSpec["kind"]`. A custom game has no "default": there's no
 * one arbitrary game to launch with a click, so `"custom"` is excluded here
 * and only reachable by describing something in chat.
 */
export type CatalogGameId = "noughts-and-crosses" | "chess";

/** Drives both the on-screen menu and the tool descriptions in the prompt. */
export const GAME_CATALOG: { id: CatalogGameId; title: string; blurb: string }[] =
  [
    {
      id: "noughts-and-crosses",
      title: "Noughts & Crosses",
      blurb: "3x3 grid, three in a row wins. Difficulty from random to unbeatable.",
    },
    {
      id: "chess",
      title: "Chess",
      blurb:
        "Full rules — castling, en passant, promotion — against a computer opponent.",
    },
  ];

/** The spec a catalog entry launches with when picked with no other input. */
export function defaultGameSpec(id: CatalogGameId): GameSpec {
  switch (id) {
    case "noughts-and-crosses":
      return normalizeNoughtsAndCrossesSpec();
    case "chess":
      return normalizeChessSpec();
  }
}
