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

Both phases below are implemented, not just planned: two curated games (Phase
A) plus a working, if unhardened, path to arbitrary ones (Phase B, via
`createCustomGame` — the agent writes a real HTML page and it runs in a
sandboxed iframe). None of this is a stub for you to replace — it's the
pattern to copy and the foundation to harden.

| File | What's there |
| --- | --- |
| `lib/game.ts` | The spec contract: a `gameSpecSchema` discriminated union on `kind`, one branch per game (including `custom`), a fixed `GENRES` list (Strategy, Shooter, Dodging, Puzzle, Platformer, Racing, Card & Tabletop, Other — deliberately not freeform, or the model would invent a new one-off genre per game), plus `GAME_CATALOG`/`CatalogGameId`/`defaultGameSpec(id)` for the two curated games specifically — `custom` is deliberately excluded from those three, since arbitrary generated content has no sensible menu default. **Read this first** — it's the shape everything else hangs off. |
| `lib/saved-games.ts` | Persistence for kept custom games — localStorage, not a database (no accounts in this app, so per-device is the right scope). Exposed as a `useSyncExternalStore`-shaped store (`subscribeSavedGames`/`getSavedGamesSnapshot`/`getSavedGamesServerSnapshot`/`writeSavedGames`), not a plain load function — reading localStorage in a `useEffect` + `setState` is exactly what `eslint-plugin-react-hooks`'s `set-state-in-effect` rule flags, and it's right to: that pattern also risks an SSR/hydration mismatch, which `useSyncExternalStore` is the actual sanctioned fix for. |
| `lib/tic-tac-toe.ts`, `lib/chess.ts` | Per-game rules + computer opponent, framework-free. Chess wraps `chess.js` for legality/check/mate and adds a small alpha-beta search (`chooseChessMove`) — read the comments there before touching search depth or the eval function. |
| `lib/*.test.mts` | Run with `npm test` (Node's built-in test runner, no extra deps). The chess suite is fixture-based (mate-in-1, a hanging piece, a known stalemate) rather than "never loses," since unlike tic-tac-toe, chess isn't solved at any depth this can search. There's nothing here for `custom` games — see "What's not done yet" below. |
| `trigger/chat.ts` | The `chat.agent` task, with one tool per curated game (`createNoughtsAndCrosses`, `createChess`) plus `createCustomGame` for everything else. The system prompt is where the real work is for the third tool — it's what tells the model to write self-contained HTML, match the app's theme, avoid external resources, and treat a follow-up as "edit the HTML you already wrote," not "start over." Read it before changing any of the three. |
| `app/components/workspace.tsx` | Owns the one `useChat` instance. Derives the active game from the newest completed create-game tool call **or** a menu selection — read the comment on `appliedToolCallId` before changing this; it's the one subtle part. |
| `app/components/game-pane.tsx` | Dispatches on `spec.kind` to the right board component. Add a `case` here for each new game. |
| `app/components/game-menu.tsx`, `noughts-and-crosses-board.tsx`, `chess-board.tsx`, `custom-game-board.tsx` | The menu — the two curated games plus any saved custom games, grouped into genre folders (native `<details>`, not custom expand/collapse state) — and one board component per game. `custom-game-board.tsx` is a title, an optional "keep this game?" prompt, and a `sandbox="allow-scripts"` iframe — no rules engine, since the agent's HTML is the whole game. It also fetches the vendored `/vendor/three.min.js` once (module-level cached promise) and inlines it into the iframe's `srcDoc` ahead of the model's own `<script>`, so custom games get a `THREE` global without the model loading or bundling it itself — see `scripts/bundle-three.mjs` below for where that file comes from. The save prompt only shows for a game fresh out of chat (see `origin` on `ActiveGame` in `workspace.tsx`) — there's no way to detect "you finished playing" from inside the sandboxed iframe, so it's offered once at generation time rather than triggered by anything happening in-game. |
| `app/actions.ts` | Session creation + session-scoped token minting. You shouldn't need to change this. |
| `scripts/bundle-three.mjs`, `public/vendor/three.min.js` | `three` ships ESM/CJS only now (no global/UMD build), so this esbuild script bundles it into an IIFE exposing `window.THREE`, checked in at `public/vendor/three.min.js` and re-run (`npm run bundle:three`) after bumping the `three` version. Loading it via a same-origin static file, rather than a CDN `<script src>` inside the game's HTML, sidesteps depending on cross-origin script loading working inside a `sandbox="allow-scripts"` iframe with no network guarantees. |

Verified working end to end: both curated games build and play correctly, a
follow-up turn changes settings on the existing game without restarting the
wrong one, switching from one game kind to another mid-conversation works,
and — for `createCustomGame` specifically — a from-scratch description ("dodge
falling blocks, arrow keys to move") produced a complete, playable canvas game
with a HUD, start/game-over screens, keyboard and touch controls, and a
difficulty ramp on the first try, and a follow-up ("make the blocks fall
faster") came back as a small, targeted diff — not a full rewrite. Custom
games are required to render with three.js (a `THREE` global, injected by
`custom-game-board.tsx` at render time — see the file table below) rather
than plain canvas/DOM; a real smoke-test prompt ("a ball that bounces around
a box, arrow keys nudge it") came back using `THREE.WebGLRenderer` correctly,
with no attempt to load or import three.js itself. See
`README.md` for setup (you'll need your own `.env` — it's gitignored, ask Matt
for the keys).

### What's not done yet

`createCustomGame` works, but "works" here means "produced a good result in
testing," not "hardened." Concretely still open:

- **No error feedback loop.** If the generated HTML throws a JS error or the
  game is simply broken, nothing tells the model or shows the user anything
  beyond a silently-failing iframe. The fix is probably: catch errors inside
  the generated page (the system prompt could require a top-level
  `window.onerror` that renders a visible message), or a way for the frontend
  to report back "this didn't work" so the user's next chat turn has that
  context. Neither exists yet.
- **Context growth.** Each edit sends the full previous HTML back through
  conversation history (that's *by design* — it's how the model edits instead
  of rewriting), but a few rounds of edits on a meaty game will add up. Watch
  for this once you're testing longer sessions; `chat.agent`'s compaction
  options (see the Backend docs) are the likely lever.
- **Quality is inherently variable.** One good result on one prompt isn't a
  guarantee — test with a spread of game types (turn-based vs. real-time,
  keyboard vs. mouse, single-screen vs. scrolling) before trusting it broadly.

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

The agent emits actual code, run in a sandboxed `<iframe sandbox="allow-scripts">`
with no same-origin access. This is what makes long, original prompts work, and
it's implemented — `createCustomGame` in `trigger/chat.ts`, rendered by
`custom-game-board.tsx`. The tradeoff that made this worth doing last (after
Phase A, not before) was real: you're executing model-authored code, and the
system prompt telling it what to write is where almost all of the actual
difficulty lives — self-contained HTML, matching the app's theme, a real game
loop, controls, a restart path, and treating an edit as "revise the HTML you
already wrote," not "start over." Read that prompt before changing it; it took
real iteration to get a first version producing consistently playable results.

What it doesn't do yet — see "What's not done yet" above — is close the loop
when the generated code is actually broken. That's the next real problem here,
not building Phase B from scratch.

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

**3. Arbitrary games — done (first pass).** `createCustomGame` writes a
complete HTML page per request, run in a sandboxed iframe alongside the two
curated games' component tree (dispatched by the same `spec.kind` switch in
`game-pane.tsx`, not a separate system — turned out not to need one). Verified
on one real, non-trivial prompt with a genuinely good result and a working
follow-up edit. That's a proof it works, not proof it's *reliable* — the real
remaining work is the hardening in "What's not done yet" above (error
feedback, context growth over many edits, testing a spread of game types),
plus judgment calls only you can make by testing more of them: does a
turn-based card game come out as clean as a real-time canvas game? Does a
multi-screen or multiplayer-feeling request degrade gracefully? Push on the
kinds of games the one tested example *doesn't* look like.

**4. Beyond that.** Once Phase B is solid, open questions worth thinking about:
should custom games get their own difficulty/settings UI the way the curated
games do (nothing stops the agent's HTML from building its own controls, but
should the app standardize this)? Should there be a way to save/share a
generated game? Should long-running custom games (anything with meaningful
state) survive a page refresh the way the curated games currently don't
either? None of this is required — just where the project goes if it keeps
growing.

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
  and turn order in both curated board components are local state *seeded*
  from the spec, not read from it every render — the difficulty slider
  changes its state live mid-game, since nothing about a computer move
  depends on the *previous* difficulty. Turn order can't work that way
  (changing it mid-game would reassign whose pieces are whose), so its toggle
  always resets the game alongside changing the setting, rather than trying
  to reinterpret the position in progress — see `TurnOrderToggle`'s `note`
  prop for how that's surfaced to the user. If a third game adds a
  live-adjustable setting, ask which category it's in (safe to change live,
  vs. needs a reset) before wiring it up.
- **The custom-game iframe has no channel back to the app.**
  `sandbox="allow-scripts"` (no `allow-same-origin`) means the generated page
  can't reach the parent DOM, cookies, or storage — deliberate, it's the
  entire security boundary the feature relies on. That also means there's no
  way today for a generated game to report a score, ask the model something
  mid-game, or otherwise talk to the rest of the app. If that's ever needed,
  it's a `postMessage` bridge you'd add on purpose, not something to route
  around the sandbox for.

## When you're stuck

Read the run trace in the dashboard before adding `console.log`. Most confusion
here is "what did the model actually get sent, and what did it actually call" —
the trace answers both directly.
