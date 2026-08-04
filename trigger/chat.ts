import { anthropic } from "@ai-sdk/anthropic";
import { chat } from "@trigger.dev/sdk/ai";
import { stepCountIs, streamText, tool } from "ai";
import { createGameInputSchema, normalizeGameSpec } from "../lib/game";

const SYSTEM_PROMPT = `You are the assistant in an app that builds playable games on demand.

The user chats with you in a panel on the left. The game you create appears in the
larger main area on the right, where they play it directly.

You can currently build one game: noughts and crosses (tic-tac-toe). Use the
\`createGame\` tool whenever the user asks for it, however they phrase it —
"tic tac toe", "noughts and crosses", "Xs and Os", or just "a simple game".

Call \`createGame\` again to change an existing game: a request like "make the
computer harder", "let me be O", or "you go first" is a new call with the updated
settings, not a conversation. Carry over the settings they didn't mention.

Difficulty maps to: 'easy' (random moves), 'medium' (a mix of good and random),
'perfect' (unbeatable minimax). If someone asks for a hard or unbeatable
opponent, use 'perfect'.

If they ask for a game you can't build yet, say so plainly in one sentence and
offer noughts and crosses instead. Don't pretend to build it.

Playing the game is entirely client-side — you are not the referee and won't see
their moves, so never ask whose turn it is or comment on the score.

Keep replies to a sentence or two. The chat pane is narrow, and the game itself
is the real output.`;

const tools = {
  createGame: tool({
    description:
      "Create or replace the noughts and crosses game shown in the main area. Also use this to change an existing game's settings.",
    inputSchema: createGameInputSchema,
    // Filling in defaults is the whole job — the returned spec is what the
    // frontend renders, so it must be complete and valid.
    execute: async (input) => normalizeGameSpec(input),
  }),
};

/**
 * The chat agent. `run` is invoked once per conversational turn with the full
 * accumulated history already converted to `ModelMessage[]`, and the
 * `StreamTextResult` we return is piped straight to the browser.
 */
export const chatAgent = chat.agent({
  id: "chat-agent",
  // Declared here as well as on streamText so each tool's schema is threaded
  // into cross-turn history conversion — without this, tool results degrade
  // from turn 2 onward.
  tools,
  // Stay warm for 5 minutes between turns so follow-up messages don't pay a
  // cold start. The session outlives the run either way.
  idleTimeoutInSeconds: 300,
  run: async ({ messages, tools, signal }) =>
    streamText({
      // Spread this FIRST: it wires up prepareStep (compaction, steering,
      // background injection), the system prompt set via chat.prompt(), and
      // telemetry. Explicit options below intentionally win.
      ...chat.toStreamTextOptions({ tools }),
      model: anthropic("claude-opus-5"),
      system: SYSTEM_PROMPT,
      messages,
      abortSignal: signal,
      stopWhen: stepCountIs(15),
      providerOptions: {
        anthropic: {
          // Thinking is on by default on Opus 5, but `display` defaults to
          // "omitted" — which reads as a long pause in a streaming UI. Ask for
          // the summary so the chat can render reasoning as it arrives.
          thinking: { type: "adaptive", display: "summarized" },
          effort: "high",
          // Safety classifiers can decline a request outright. Let the API
          // re-run it on the recommended fallback model instead of surfacing a
          // dead turn to the user.
          fallbacks: "default",
        },
      },
    }),
});
