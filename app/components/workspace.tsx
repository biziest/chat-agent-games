"use client";

import { useChat } from "@ai-sdk/react";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { mintChatAccessToken, startChatSession } from "@/app/actions";
import { ChatPane } from "@/app/components/chat-pane";
import { GamePane } from "@/app/components/game-pane";
import {
  defaultGameSpec,
  gameSpecSchema,
  GAME_TOOL_NAMES,
  type CatalogGameId,
  type GameSpec,
} from "@/lib/game";
// Type-only: erased at build time, so the server-only agent module never
// reaches the client bundle. It gives the transport a compile-time check on the
// task id and the message shape.
import type { chatAgent } from "@/trigger/chat";

type ActiveGame = { id: string; spec: GameSpec };

/**
 * Owns the chat so both panes can read from it: the conversation renders on
 * the left, and the game on the right comes from either the newest completed
 * create-game tool call, or a direct menu selection (see `handleSelectGame`).
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

  const [game, setGame] = useState<ActiveGame | null>(null);

  // The id of the last tool call we already applied to `game`. Menu
  // selections write their own synthetic id into `game` without touching this
  // ref, so a later render that re-finds the same old tool call in history
  // (nothing new happened) doesn't clobber a manual menu pick.
  const appliedToolCallId = useRef<string | null>(null);

  useEffect(() => {
    const found = latestToolGame(messages);
    if (found && found.id !== appliedToolCallId.current) {
      appliedToolCallId.current = found.id;
      setGame(found);
    }
  }, [messages]);

  // `useChat`'s own stop() doesn't reach the backend once a stream has been
  // reconnected, so signal the run directly and then settle the local state.
  const stop = useCallback(() => {
    void transport.stopGeneration(chatId);
    aiStop();
  }, [transport, chatId, aiStop]);

  // Launching a default game needs no intelligence, so this skips the model
  // entirely — see app/components/game-menu.tsx.
  const handleSelectGame = useCallback((id: CatalogGameId) => {
    setGame({ id: `menu-${id}-${crypto.randomUUID()}`, spec: defaultGameSpec(id) });
  }, []);

  const handleExitGame = useCallback(() => setGame(null), []);

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
        {/* Keying on the game id resets board state whenever the agent
            builds/changes the game, or the user picks a new one from the menu. */}
        <GamePane
          key={game?.id ?? "menu"}
          game={game}
          onSelectGame={handleSelectGame}
          onExitGame={handleExitGame}
        />
      </main>
    </div>
  );
}

/**
 * Walks the conversation backwards for the newest completed create-game tool
 * call, of either kind. The tool output is validated rather than trusted — it
 * originates from a model call, and a spec that doesn't match the schema
 * should mean "no game found" instead of a crashed render.
 */
function latestToolGame(messages: UIMessage[]): ActiveGame | null {
  for (let m = messages.length - 1; m >= 0; m--) {
    const parts = messages[m].parts;
    for (let p = parts.length - 1; p >= 0; p--) {
      const part = parts[p];
      if (!isToolUIPart(part)) continue;
      if (!GAME_TOOL_NAMES.has(getToolName(part))) continue;
      if (part.state !== "output-available") continue;

      const parsed = gameSpecSchema.safeParse(part.output);
      if (parsed.success) return { id: part.toolCallId, spec: parsed.data };
    }
  }
  return null;
}
