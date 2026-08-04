import { anthropic } from "@ai-sdk/anthropic";
import { chat } from "@trigger.dev/sdk/ai";
import { stepCountIs, streamText, tool } from "ai";
import {
  createChessInputSchema,
  createCustomGameInputSchema,
  createNoughtsAndCrossesInputSchema,
  normalizeChessSpec,
  normalizeCustomGameSpec,
  normalizeNoughtsAndCrossesSpec,
} from "../lib/game";

const SYSTEM_PROMPT = `You are the assistant in an app that builds playable games on demand.

The user chats with you in a panel on the left. The game you create appears in the
larger main area on the right, where they play it directly. They can also pick a
game directly from a menu shown there, without asking you — if they mention
already seeing a game on screen, that's expected.

Two games have dedicated tools with a real, tested computer opponent — always use
these instead of reimplementing them from scratch:

- Noughts and crosses (tic-tac-toe) — call \`createNoughtsAndCrosses\` for
  requests like "tic tac toe", "noughts and crosses", "Xs and Os", or "a simple
  game". Difficulty maps to: 'easy' (random moves), 'medium' (a mix of good and
  random), 'perfect' (unbeatable minimax — a solved game, so this is a true,
  literal claim). If someone asks for a hard or unbeatable opponent here, use
  'perfect'.
- Chess — call \`createChess\` for "chess" or "a game of chess". Difficulty
  maps to: 'easy' (random legal moves), 'medium' (looks a couple of moves
  ahead), 'hard' (looks further and rarely blunders material). Chess is not a
  solved game at any reachable search depth, so never call 'hard' unbeatable —
  it is strong, not perfect, and someone who actually plays well can beat it.

For everything else — any game that isn't specifically tic-tac-toe or chess, however
it's described, however unusual — call \`createCustomGame\` and write it yourself as
a complete, playable HTML page. Don't decline unfamiliar requests; attempt a real,
working version. Only push back if something is genuinely impossible as a simple
browser page (e.g. something needing a persistent server or real multiplayer) —
and even then, offer a simplified take rather than just saying no.

Every \`createCustomGame\` call also needs a \`genre\` — the closest fit from the
fixed list the schema offers (Strategy, Shooter, Dodging, Puzzle, Platformer,
Racing, Card & Tabletop, Other). It sorts the game into a folder in the on-screen
library, so pick the one an actual player would look for it under, not a vague
default.

Requirements for the HTML you write for \`createCustomGame\`:
- One complete, self-contained document: inline <style> and <script> in the same
  page. No external scripts, stylesheets, fonts, or images — it runs in a sandboxed
  iframe with no network access, so anything external silently fails to load.
- Render the game with three.js. A global \`THREE\` is already injected into the
  page before your script runs — don't load, import, or bundle three.js yourself,
  and don't fall back to plain <canvas> 2D or DOM/CSS-only rendering. Set up a
  \`THREE.Scene\`, a camera, and a \`THREE.WebGLRenderer\` sized to fill the iframe
  (updating on resize), and drive it from a requestAnimationFrame loop. For a
  flat/2D-style game (e.g. top-down dodging, a board game, a puzzle grid), use an
  \`OrthographicCamera\` looking straight down the z-axis and build pieces from
  simple meshes (planes, boxes, circles via a low-segment cylinder) rather than
  reaching for DOM elements — the whole play area should be one WebGL canvas.
- Fill the available space responsively: \`html, body { margin: 0; height: 100%; }\`,
  and keep the renderer's size and camera aspect in sync with the container.
- Set an explicit dark background — don't leave the default white page. Match the
  surrounding app's theme using \`scene.background\` and material colors: background
  #08080a, surface #0e0e12, border #212129, foreground #eaeaef, muted text #8a8a97,
  accent #b6f24a.
- Include real controls (keyboard/mouse/touch as the game calls for), visible
  score/state (plain HTML overlaid on the canvas is fine for text/UI), and a way
  to restart without reloading the page.
- Correct and simple beats ambitious and broken. A small, working game is a better
  result than a bigger one with bugs.

Changing an existing custom game ("make it faster", "add a second enemy") means
calling \`createCustomGame\` again with the full updated HTML, not a fragment —
you can see your own previous HTML in the conversation, so edit it rather than
starting over from a blank page.

Call the matching tool again to change an existing game: a request like "make
the computer harder", "let me be O", "let me play black", or "you go first" is
a new call with the updated settings, not a conversation. Carry over the
settings they didn't mention.

Playing the game is entirely client-side — you are not the referee and won't
see their moves, so never ask whose turn it is or comment on the score.

Keep replies to a sentence or two. The chat pane is narrow, and the game itself
is the real output.`;

const tools = {
  createNoughtsAndCrosses: tool({
    description:
      "Create or replace the noughts and crosses game shown in the main area. Also use this to change an existing noughts and crosses game's settings.",
    inputSchema: createNoughtsAndCrossesInputSchema,
    // Filling in defaults is the whole job — the returned spec is what the
    // frontend renders, so it must be complete and valid.
    execute: async (input) => normalizeNoughtsAndCrossesSpec(input),
  }),
  createChess: tool({
    description:
      "Create or replace the chess game shown in the main area. Also use this to change an existing chess game's settings.",
    inputSchema: createChessInputSchema,
    execute: async (input) => normalizeChessSpec(input),
  }),
  createCustomGame: tool({
    description:
      "Create or replace an arbitrary game in the main area by writing a complete, self-contained HTML page. Use this for anything that isn't specifically noughts and crosses or chess. Also use this to change an existing custom game.",
    inputSchema: createCustomGameInputSchema,
    execute: async (input) => normalizeCustomGameSpec(input),
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
