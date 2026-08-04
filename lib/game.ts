import { z } from "zod";

/**
 * The contract between the agent and the UI. The agent authors one of these;
 * the browser renders it and owns all gameplay state from there.
 *
 * Lives at the repo root so both `trigger/` and `app/` can import it without
 * either pulling in the other's dependencies.
 */
export const gameSpecSchema = z.object({
  kind: z.literal("noughts-and-crosses"),
  title: z.string(),
  playerMark: z.enum(["X", "O"]),
  difficulty: z.enum(["easy", "medium", "perfect"]),
  firstMove: z.enum(["player", "computer"]),
});

export type GameSpec = z.infer<typeof gameSpecSchema>;

/**
 * What the model fills in. Everything is optional so a bare "make tic tac toe"
 * is a valid call — `normalizeGameSpec` supplies the rest.
 */
export const createGameInputSchema = z.object({
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

export type CreateGameInput = z.infer<typeof createGameInputSchema>;

export function normalizeGameSpec(input: CreateGameInput): GameSpec {
  return {
    kind: "noughts-and-crosses",
    title: input.title?.trim() || "Noughts & Crosses",
    playerMark: input.playerMark ?? "X",
    difficulty: input.difficulty ?? "medium",
    firstMove: input.firstMove ?? "player",
  };
}
