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

Read these four files first — it's about 350 lines total.

| File | What's there |
| --- | --- |
| `trigger/chat.ts` | The `chat.agent` task. One `run()` per turn, streaming back to the browser. No tools yet — **this is where you start.** |
| `app/actions.ts` | Session creation + session-scoped token minting. You shouldn't need to change this. |
| `app/components/chat.tsx` | `useChat` + `useTriggerChatTransport`. Renders text and reasoning parts. |
| `app/page.tsx` | The 1/3 ÷ 2/3 split. The right pane is a placeholder — replace it. |

Verified working: a turn streams back from `claude-opus-5`, reasoning included.
See `README.md` for setup (you'll need your own `.env` — it's gitignored, ask
Matt for the keys).

## The one big decision

**How does a game get from the agent to the right-hand pane?** Everything else
follows from this. There are two honest answers and you will probably need both,
in this order:

### Phase A — a spec the frontend knows how to render

The agent calls a tool with a JSON description of the game. You write React
components that render each supported shape.

```ts
renderGame({
  kind: "grid-turn-based",
  rows: 3, cols: 3,
  winCondition: { type: "n-in-a-row", n: 3 },
  players: [{ mark: "X", human: true }, { mark: "O", ai: "minimax" }],
})
```

Bounded, safe, fast, easy to debug. The ceiling is real though: you can only
render games you anticipated. "Make a roguelike" won't work.

Trigger.dev's own [ClickHouse chat agent](https://trigger.dev/docs/guides/example-projects/clickhouse-chat-agent)
does exactly this shape for charts, using `@json-render/*` to map a validated
spec to React components. Worth reading before you design your own.

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

**1. One game, hardcoded.** "Create a simple game like tic tac toe" produces a
playable tic-tac-toe on the right. Cheat freely — a single tool with no
parameters that flips on a hardcoded component is a completely legitimate first
step. What you're proving is the *plumbing*: tool call → frontend render →
playable. Don't move on until clicking a square works.

**2. A small catalog.** Tic-tac-toe, connect four, and a memory/matching game,
all from one parameterized spec. The agent picks the shape and fills in the
parameters. Now you'll find out whether your spec was designed well — expect to
redesign it here, that's the point. Also: does "make the board 5x5" work as a
follow-up turn, without starting over?

**3. Arbitrary games.** Long prompts describing original games. This is where
Phase B lands. Test with something with unusual mechanics — not a re-skinned
version of something from step 2.

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

## When you're stuck

Read the run trace in the dashboard before adding `console.log`. Most confusion
here is "what did the model actually get sent, and what did it actually call" —
the trace answers both directly.
