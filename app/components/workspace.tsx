"use client";

import { useChat } from "@ai-sdk/react";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { useCallback, useMemo, useState } from "react";
import { mintChatAccessToken, startChatSession } from "@/app/actions";
import { ChatPane } from "@/app/components/chat-pane";
import { GamePane } from "@/app/components/game-pane";
import { gameSpecSchema, type GameSpec } from "@/lib/game";
// Type-only: erased at build time, so the server-only agent module never
// reaches the client bundle. It gives the transport a compile-time check on the
// task id and the message shape.
import type { chatAgent } from "@/trigger/chat";

/**
 * Owns the chat so both panes can read from it: the conversation renders on the
 * left, and the most recent `createGame` result drives the game on the right.
 */
export function Workspace() {
  // One chat per page load. Persist this (plus the session state) if you want
  // conversations to survive a refresh — see the Frontend docs on `resume`.
  const [chatId] = useState(() => crypto.randomUUID());

  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat-agent",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
  });

  const {
    messages,
    sendMessage,
    status,
    error,
    clearError,
    stop: aiStop,
  } = useChat({ id: chatId, transport });

  const game = useMemo(() => latestGame(messages), [messages]);

  // `useChat`'s own stop() doesn't reach the backend once a stream has been
  // reconnected, so signal the run directly and then settle the local state.
  const stop = useCallback(() => {
    void transport.stopGeneration(chatId);
    aiStop();
  }, [transport, chatId, aiStop]);

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <aside className="flex h-full w-1/3 min-w-0 flex-col border-r border-border bg-surface">
        <ChatPane
          messages={messages}
          status={status}
          error={error}
          onSend={(text) => void sendMessage({ text })}
          onStop={stop}
          onDismissError={clearError}
        />
      </aside>

      <main className="flex h-full min-w-0 flex-1 flex-col bg-background">
        {/* Keying on the tool call id resets board state whenever the agent
            builds or changes the game. */}
        <GamePane key={game?.id ?? "empty"} game={game?.spec ?? null} />
      </main>
    </div>
  );
}

/**
 * Walks the conversation backwards for the newest completed `createGame` call.
 * The tool output is validated rather than trusted — it originates from a model
 * call, and a spec that doesn't match the schema should mean "no game" instead
 * of a crashed render.
 */
function latestGame(
  messages: UIMessage[],
): { id: string; spec: GameSpec } | null {
  for (let m = messages.length - 1; m >= 0; m--) {
    const parts = messages[m].parts;
    for (let p = parts.length - 1; p >= 0; p--) {
      const part = parts[p];
      if (!isToolUIPart(part)) continue;
      if (getToolName(part) !== "createGame") continue;
      if (part.state !== "output-available") continue;

      const parsed = gameSpecSchema.safeParse(part.output);
      if (parsed.success) return { id: part.toolCallId, spec: parsed.data };
    }
  }
  return null;
}
