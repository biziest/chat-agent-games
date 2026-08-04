# Brief: chat-driven game generation

Welcome Andrew. This repo is a working scaffold, not a blank page — your job is
to turn it into something that builds games on demand.

## The goal

A user types a description of a game into the chat on the left. A playable
version of that game appears in the main area on the right.

```
┌──────────────┬────────────────────────────┐
│ CHAT (1/3)   │  GAME (2/3)                │
│              │                            │
│ "make tic    │      ┌───┬───┬───┐         │
│  tac toe"    │      │ X │   │ O │         │
│              │      ├───┼───┼───┤         │
│ "now make    │      │   │ X │   │         │
│  the AI      │      ├───┼───┼───┤         │
│  harder"     │      │ O │   │ X │         │
│              │      └───┴───┴───┘         │
│ > ________   │      X to move             │
└──────────────┴────────────────────────────┘
```

Success looks like: paste in three paragraphs describing an original game, and
get a good version of it, playable, without touching the code.

## What already works

Two games ship as a working example of Phase A (below): noughts and crosses and
chess, both built from a validated spec the agent authors and the frontend
renders. This isn't a stub for you to replace — it's the pattern to copy when
you add the third, fourth, and fifth games, and it's what you'll outgrow when
you get to Phase B.

| File | What's there |
| --- | --- |
| `lib/game.ts` | The spec contract: a `gameSpecSchema` discriminated union on `kind`, one branch per game, plus `GAME_CATALOG` (drives the on-screen menu) and `defaultGameSpec(id)`. **Read this first** — it's the shape everything else hangs off. |
| `lib/tic-tac-toe.ts`, `lib/chess.ts` | Per-game rules + computer opponent, framework-free. Chess wraps `chess.js` for legality/check/mate and adds a small alpha-beta search (`chooseChessMove`) — read the comments there before touching search depth or the eval function. |
| `lib/*.test.mts` | Run with `npm test` (Node's built-in test runner, no extra deps). The chess suite is fixture-based (mate-in-1, a hanging piece, a known stalemate) rather than "never loses," since unlike tic-tac-toe, chess isn't solved at any depth this can search. |
| `trigger/chat.ts` | The `chat.agent` task, with one tool per game (`createNoughtsAndCrosses`, `createChess`). This is the pattern for a third game: a tool whose `execute` normalizes input into a spec via `lib/game.ts`. |
| `app/components/workspace.tsx` | Owns the one `useChat` instance. Derives the active game from the newest completed create-game tool call **or** a menu selection — read the comment on `appliedToolCallId` before changing this; it's the one subtle part. |
| `app/components/game-pane.tsx` | Dispatches on `spec.kind` to the right board component. Add a `case` here for each new game. |
| `app/components/game-menu.tsx`, `noughts-and-crosses-board.tsx`, `chess-board.tsx` | The menu, and one board component per game. |
| `app/actions.ts` | Session creation + session-scoped token minting. You shouldn't need to change this. |

Verified working end to end: both games build and play correctly, a follow-up
turn changes settings on the existing game without restarting the wrong one,
switching from one game kind to another mid-conversation works, and an
unsupported request gets an honest decline instead of a fake build. See
`README.md` for setup (you'll need your own `.env` — it's gitignored, ask Matt
for the keys).

## The one big decision

**How does a game get from the agent to the right-hand pane?** Everything else
follows from this. There are two honest answers and you will probably need both,
in this order:

### Phase A — a spec the frontend knows how to render

The agent calls a tool with a JSON description of the game. You write React
components that render each supported shape. This repo's `lib/game.ts` does
exactly this, as a real, working example rather than a sketch:

```ts
export const gameSpecSchema = z.discriminatedUnion("kind", [
  noughtsAndCrossesSpecSchema, // { kind: "noughts-and-crosses", playerMark, difficulty, firstMove }
  chessSpecSchema,             // { kind: "chess", playerColor, difficulty }
]);
```

One tool per `kind`, one board component per `kind`, dispatched by
`app/components/game-pane.tsx`. Bounded, safe, fast, easy to debug. The ceiling
is real though: you can only render games you anticipated. "Make a roguelike"
won't work — see for yourself, it declines honestly instead of faking it.

Trigger.dev's own [ClickHouse chat agent](https://trigger.dev/docs/guides/example-projects/clickhouse-chat-agent)
does the same shape for charts, using `@json-render/*` to map a validated spec
to React components. Worth reading before you extend this one further.

### Phase B — the agent writes the game

The agent emits actual code (HTML/JS, or a React component), and you run it in a
sandboxed `<iframe sandbox="allow-scripts">` with no same-origin access. This is
what makes long, original prompts work.

The tradeoffs get real here: you're executing model-authored code, so the sandbox
boundary matters, and errors need a path back to the model so it can fix its own
output. Don't start here. Get Phase A working end to end first — you'll learn
what the games actually need, and that tells you what Phase B's interface should
look like.

## The mistake to avoid

**Don't make the model the game loop.** It is tempting to have the agent evaluate
every move: user clicks a square → new turn → model decides what happens. This
will feel broken. Every move becomes a model call — seconds of latency, real
cost, and non-deterministic rules.

Instead: **the agent is the game's author, the browser is its engine.** The agent
runs when the game is created or changed. Once it exists, clicking around is pure
client-side state — instant and deterministic.

The agent should re-enter the loop when the user wants the game *changed*
("make the AI harder", "add a timer"), not when they want to *play* it.

## Milestones

**0. Get it running.** `trigger dev` in one terminal, `npm run dev` in another.
Send a message, watch the run in the Trigger.dev dashboard. Read the trace — you
can see the model call, the streamed chunks, the timings. This is your main
debugging tool; get comfortable with it now.

**1. One game, hardcoded. — done.** Noughts and crosses: tool call → frontend
render → playable, including the computer opponent. Read it before you build
the third game; it's the smallest complete example of the pattern.

**2. A small catalog. — done.** Chess is the second game, on the same
discriminated-union spec, with its own board component and its own opponent
(a shallow alpha-beta search over `chess.js`, not the tic-tac-toe minimax —
chess isn't solved at any depth this can search, so don't claim "unbeatable"
for it the way the system prompt correctly does for tic-tac-toe). There's also
a menu now (`app/components/game-menu.tsx`) so a default game can start with a
click, no model call needed for that — see the comment on `handleSelectGame` in
`workspace.tsx` for why that's deliberate. Before adding a third game, try the
follow-up-turn test from the original milestone 2: does "make the board 5x5"
(or the chess equivalent) work as a settings change, without restarting the
wrong game or losing unrelated settings? It does today — `trigger/chat.ts`'s
prompt and `workspace.tsx`'s tool-call tracking are why; understand both before
you touch either.

**3. Arbitrary games — this is the real target now.** Long prompts describing
original games. This is where Phase B lands, and it's genuinely unsolved in
this repo — everything above was scaffolding to learn the plumbing from, not a
foundation Phase B builds on top of (a spec-rendering pane and a
code-execution pane are different enough that you may end up with a separate
component tree for Phase B games, dispatched alongside the `kind` switch in
`game-pane.tsx`). Test with something with unusual mechanics — not a re-skinned
version of tic-tac-toe or chess.

## Pointers

- [Tools](https://trigger.dev/docs/ai-chat/tools) — read this before writing your
  first tool
- [Custom data parts](https://trigger.dev/docs/ai-chat/backend#custom-data-parts) —
  `chat.response.write({ type: "data-game", data })`, an alternative to tool
  output for pushing state to the frontend. Worth understanding both before
  choosing.
- [Frontend](https://trigger.dev/docs/ai-chat/frontend) — session management,
  resuming after refresh
- [Types](https://trigger.dev/docs/ai-chat/types) — `chat.withUIMessage` gets you
  typed message parts on the client, so the render code isn't guessing
- [Code sandbox pattern](https://trigger.dev/docs/ai-chat/patterns/code-sandbox) —
  relevant to Phase B
- [AI SDK tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)

## Gotchas that will cost you an afternoon

- **Declare tools on `chat.agent({ tools })`, not just on `streamText`.** Passing
  them only to `streamText` works on turn 1 and silently breaks from turn 2, as
  the history is re-converted without your tools' `toModelOutput`. `trigger/chat.ts`
  is already set up to read them back off the `run()` payload.
- **Keep `...chat.toStreamTextOptions({ tools })` spread first** in `streamText`.
  It wires up compaction, steering, and background injection. Remove it and those
  features no-op — silently, with no error.
- **Return tool errors to the model instead of throwing.** If the generated spec
  is invalid, hand the validation error back as the tool result and let the model
  correct itself. This one trick does most of the work in getting complex
  generations to land.
- **`chatId` is regenerated per page load**, so a refresh starts a new
  conversation. If you want games to survive a refresh, that's a real feature —
  see "Restoring on page load" in the Frontend docs.
- **`ANTHROPIC_API_KEY` stays server-side.** It's read by the Trigger.dev worker
  from `.env`. It must never reach the client bundle. Same for
  `TRIGGER_SECRET_KEY`.
- **`import type` for anything from `trigger/`** in client components. A value
  import drags server-only code into the browser bundle.
- **Adding a game means touching `GAME_TOOL_NAMES` in `lib/game.ts`, not just
  `trigger/chat.ts`.** It's the list `workspace.tsx` scans message history
  against to find create-game tool calls. Miss it and the tool executes fine,
  the model says it built the game, and nothing ever appears — a confusing one
  to debug because everything *looks* like it worked.
- **Don't stash a stateful engine object (anything like `chess.js`'s `Chess`,
  with its own move history) in a `ref` and read `.current` during render.**
  `eslint-plugin-react-hooks` now flags this (`react-hooks/refs`), and it's
  right to: React's rendering model doesn't guarantee render runs once or in
  order. Keep the move list in state and rebuild the engine object with
  `useMemo` when it changes — see `chess-board.tsx` for the pattern, including
  why a fresh `useMemo`'d instance still gets correct repetition detection
  (full replay from the start, not a bare FEN restore).
- **Spec fields aren't necessarily fixed for the life of a game.** Difficulty
  and turn order in both board components are local state *seeded* from the
  spec, not read from it every render — the difficulty slider changes its
  state live, since nothing about a computer move depends on the *previous*
  difficulty. Turn order can't work that way (changing it mid-game would
  reassign whose pieces are whose), so its toggle is only enabled while a
  `gameStarted` check is false. If a third game adds a live-adjustable
  setting, ask which category it's in before wiring it up.

## When you're stuck

Read the run trace in the dashboard before adding `console.log`. Most confusion
here is "what did the model actually get sent, and what did it actually call" —
the trace answers both directly.
