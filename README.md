# chat-agent-games

A [Trigger.dev](https://trigger.dev) `chat.agent` embedded in a Next.js app. Dark
theme, chat pane on the left third of the viewport, main area on the right.

The agent runs as a durable Trigger.dev task, so the conversation is backed by a
Session that outlives individual runs. There are **no API routes** — the browser
talks to Trigger.dev directly using a short-lived, session-scoped token minted by
a server action.

## Layout

```
┌──────────────┬────────────────────────────┐
│ CHAT (1/3)   │  MAIN AREA (2/3)           │
│              │                            │
│  messages    │  placeholder — fill this   │
│  ──────────  │  in from app/page.tsx      │
│  > compose   │                            │
└──────────────┴────────────────────────────┘
```

## Files that matter

| Path                      | What it does                                                               |
| ------------------------- | -------------------------------------------------------------------------- |
| `trigger/chat.ts`         | The `chat.agent` task — one `run()` per turn, streamed back to the browser  |
| `app/actions.ts`          | Two server actions: create the session, mint a session-scoped token         |
| `app/components/chat.tsx` | `useChat` + `useTriggerChatTransport`, message rendering, composer          |
| `app/page.tsx`            | The 1/3 ÷ 2/3 split                                                        |
| `app/globals.css`         | Dark theme tokens, exposed to Tailwind via `@theme inline`                  |
| `trigger.config.ts`       | Points the CLI at `./trigger`                                              |

## Setup

Node 24 lives at `~/.local/node`, symlinked into `~/.local/bin` (which is on
`PATH`). Project ref `proj_ipkxwnbsnpiulciaywyp` is already in
`trigger.config.ts`, and the CLI is logged in.

1. **Create `.env.local`** with two values:

   ```
   ANTHROPIC_API_KEY=sk-ant-...   # read by the dev worker
   TRIGGER_SECRET_KEY=tr_dev_...  # read by the server actions in app/actions.ts
   ```

   `trigger dev` loads `.env`, `.env.local`, `.env.development`, and
   `.env.development.local`, so the Anthropic key doesn't need to go in the
   dashboard for local development — but it **does** for deployed environments
   (dashboard → Environment Variables). The dev secret key is under
   Project settings → API keys.

2. **Run both processes**, in separate terminals:

   ```bash
   npx trigger.dev@latest dev   # the agent
   npm run dev                  # the app → http://localhost:3000
   ```

## Notes

- **Model:** `claude-opus-5` via `@ai-sdk/anthropic`, with adaptive thinking
  (`display: "summarized"`, so the chat can render reasoning as it streams),
  `effort: "high"`, and `fallbacks: "default"` so a safety-classifier refusal is
  re-run on the recommended fallback model instead of dead-ending the turn.
- **`chat.toStreamTextOptions()` is spread first** in `streamText`. It wires up
  compaction, mid-turn steering, and background injection; skipping it makes
  those features silently no-op.
- **Chat persistence:** `chatId` is generated per page load, so a refresh starts
  a fresh conversation. To resume instead, persist the messages and session
  state and pass `resume: true` to `useChat` — see
  [Frontend → Restoring on page load](https://trigger.dev/docs/ai-chat/frontend).
- **Adding tools:** declare them on `chat.agent({ tools })` *and* read them back
  from the `run()` payload (already wired). Declaring them on the config is what
  keeps each tool's `toModelOutput` applied when history is re-converted on later
  turns.
- **AI SDK v7** (`ai@7`, `@ai-sdk/react@4`) with `@ai-sdk/otel` installed so model
  calls show up as spans in the run trace. Trigger.dev also supports v5 and v6.
