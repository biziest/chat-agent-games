"use client";

import { Chat, useChat } from "@ai-sdk/react";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { mintChatAccessToken, startChatSession } from "@/app/actions";
import { ChatPane } from "@/app/components/chat-pane";
import { GamePane } from "@/app/components/game-pane";
import {
  defaultGameSpec,
  gameSpecSchema,
  GAME_CATALOG,
  GAME_TOOL_NAMES,
  type CatalogGameId,
  type CustomGameSpec,
  type GameSpec,
} from "@/lib/game";
import { loadActiveSession, saveActiveSession } from "@/lib/active-session-storage";
import { FLUSH_PROGRESS_WAIT_MS, REQUEST_PROGRESS_MESSAGE_TYPE } from "@/lib/custom-game-protocol";
import { buildResumeMessageText } from "@/lib/resume-message";
import {
  getSavedGamesServerSnapshot,
  getSavedGamesSnapshot,
  subscribeSavedGames,
  writeSavedGames,
  type SavedGame,
} from "@/lib/saved-games";
// Type-only: erased at build time, so the server-only agent module never
// reaches the client bundle. It gives the transport a compile-time check on the
// task id and the message shape.
import type { chatAgent } from "@/trigger/chat";

// One of these per game the player has created or launched this session — its
// `chat` is that game's own dedicated conversation, so editing one game never
// bleeds into another's history. "chat" origin = the game came from
// describing it in the lobby chat (see `lobbyChat` below), and this session's
// `chat` *is* that same conversation, claimed once the model built something.
// "menu" origin = a catalog pick or a saved-library launch, which starts a
// fresh chat with one real resume turn already sent — see
// `buildResumeMessageText` in lib/resume-message.ts for why a real turn is
// required here and a client-side-only fake one wouldn't do.
type GameSession = {
  id: string;
  spec: GameSpec;
  origin: "chat" | "menu";
  chat: Chat<UIMessage>;
  // Opaque, board-owned resume state (move history, or whatever a custom
  // game last reported — see custom-game-board.tsx). Kept here rather than
  // as local state inside the board component so it survives leaving to the
  // menu and coming back: `GamePane` remounts the board on every visit
  // (see the comment by its `key`), so anything the board wants preserved
  // has to live above that remount boundary.
  progress?: unknown;
};

type ActiveGame = { id: string; spec: GameSpec; origin: "chat" | "menu" };

// Everything switching games needs to update together, in one setState call
// — `eslint-plugin-react-hooks`'s `set-state-in-effect` rule flags an effect
// with more than one setState call site, and the tool-call effect below
// needs to move a game from the lobby into `sessions` (two pieces of state
// changing atomically) as well as just update one in place.
type WorkspaceState = {
  // The chat shown at the menu, for describing a new game from scratch. Once
  // it produces its first game (see the tool-call effect below), it's moved
  // into `sessions` under its own id and replaced with a fresh one here — so
  // the *next* from-scratch description doesn't inherit the old game's
  // history.
  lobbyChat: Chat<UIMessage>;
  sessions: Map<string, GameSession>;
  activeSessionId: string | null;
};

type Transport = ReturnType<typeof useTriggerChatTransport<typeof chatAgent>>;

// How many times to silently retry a transient model-overload error before
// actually showing it to the player.
const MAX_AUTO_RETRIES = 2;

function makeChat(transport: Transport): Chat<UIMessage> {
  return new Chat<UIMessage>({ id: crypto.randomUUID(), transport, messages: [] });
}

/**
 * Owns every chat in the app: one always-available "lobby" conversation for
 * describing a brand-new game, and one dedicated conversation per game
 * that's been created or launched, so a follow-up like "make it harder"
 * always lands on the game currently on screen. Switching which game is
 * displayed (menu, saved library, or the lobby chat producing a new one)
 * switches which conversation `useChat` is bound to — see `activeChat` below.
 */
export function Workspace() {
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat-agent",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) => startChatSession({ chatId, clientData }),
  });

  // Restores whatever game was on screen when the page was last reloaded —
  // see lib/active-session-storage.ts. Reusing its chat id (rather than a
  // fresh one) is what lets the model still act on edit requests afterward:
  // chat.agent keeps that conversation's history durably server-side keyed
  // by id, independent of this fresh, empty client-side `Chat` object.
  const [state, setState] = useState<WorkspaceState>(() => {
    const persisted = loadActiveSession();
    const sessions = new Map<string, GameSession>();
    if (persisted) {
      sessions.set(persisted.id, {
        id: persisted.id,
        spec: persisted.spec,
        origin: persisted.origin,
        chat: new Chat<UIMessage>({ id: persisted.id, transport, messages: [] }),
        progress: persisted.progress,
      });
    }
    return {
      lobbyChat: makeChat(transport),
      sessions,
      activeSessionId: persisted?.id ?? null,
    };
  });
  const { lobbyChat, sessions, activeSessionId } = state;

  const activeSession = activeSessionId ? (sessions.get(activeSessionId) ?? null) : null;
  const activeChat = activeSession?.chat ?? lobbyChat;

  // Keeps the persisted "what was I looking at" pointer in sync — cleared
  // when there's no active game (the menu itself isn't restored, only a
  // game in progress), overwritten with the latest spec/progress otherwise.
  useEffect(() => {
    saveActiveSession(
      activeSession
        ? {
            id: activeSession.id,
            spec: activeSession.spec,
            origin: activeSession.origin,
            progress: activeSession.progress,
          }
        : null,
    );
  }, [activeSession]);

  const {
    messages,
    sendMessage,
    status,
    error,
    clearError,
    regenerate,
    stop: aiStop,
  } = useChat({ chat: activeChat });

  // Anthropic's models intermittently return a transient overload (a real
  // 529 from their API, not a bug here — confirmed by hitting the API
  // directly during the 2026-08-05 investigation), and chat.agent normalizes
  // every model-call failure to this same generic text, so matching on it
  // is the only way to tell "transient, worth retrying" apart from a real
  // bug. Retries with backoff before ever showing the player an error;
  // `retryAttempts` resets to 0 whenever the error clears (a fresh chat, or
  // a successful regenerate), so it doesn't leak across chats or turns.
  const retryAttempts = useRef(0);
  const [autoRetrying, setAutoRetrying] = useState(false);
  useEffect(() => {
    if (!error) retryAttempts.current = 0;
    const shouldRetry =
      error?.message === "An error occurred." && retryAttempts.current < MAX_AUTO_RETRIES;
    setAutoRetrying(shouldRetry);
    if (!shouldRetry) return;
    retryAttempts.current += 1;
    const timer = setTimeout(() => void regenerate(), retryAttempts.current * 1500);
    return () => clearTimeout(timer);
  }, [error, regenerate]);

  // The toolCallId of the last create-game call already applied to `state`.
  // Shared across every chat rather than per-session — toolCallIds are
  // globally unique, so switching to a different chat naturally re-triggers
  // this once for that chat's own latest call, which is a harmless no-op if
  // it was already applied before.
  const appliedToolCallId = useRef<string | null>(null);

  useEffect(() => {
    const found = latestToolCall(messages);
    if (!found || found.toolCallId === appliedToolCallId.current) return;
    appliedToolCallId.current = found.toolCallId;
    setState((prev) => applyToolCall(prev, found, transport));
  }, [messages, transport]);

  // `useChat`'s own stop() doesn't reach the backend once a stream has been
  // reconnected, so signal the run directly and then settle the local state.
  const stop = useCallback(() => {
    void transport.stopGeneration(activeChat.id);
    aiStop();
  }, [transport, activeChat, aiStop]);

  // The currently-mounted custom game's iframe window, if any — reported by
  // custom-game-board.tsx, null once it's gone. Curated games (chess,
  // noughts) never set this, so flushActiveProgress below is a no-op for
  // them (nothing to flush; their progress is already reported as it
  // happens — see the effect in each of their board components).
  const activeGameWindow = useRef<Window | null>(null);
  const handleIframeWindowChange = useCallback((win: Window | null) => {
    activeGameWindow.current = win;
  }, []);

  // A custom game only reports progress when *it* decides something's worth
  // resuming from (see the contract in trigger/chat.ts) — not continuously —
  // so leaving between two such checkpoints would otherwise lose whatever
  // happened since the last one. Asking it to report its state right now,
  // then giving it a brief moment to answer before actually navigating away,
  // closes that gap.
  const flushActiveProgress = useCallback(async () => {
    const win = activeGameWindow.current;
    if (!win) return;
    win.postMessage({ type: REQUEST_PROGRESS_MESSAGE_TYPE }, "*");
    await new Promise((resolve) => setTimeout(resolve, FLUSH_PROGRESS_WAIT_MS));
  }, []);

  // Starts (or, given a stable `sessionId` that's already open, resumes) a
  // dedicated chat for a game launched without going through the lobby (a
  // menu click or a saved-library pick). A fresh chat immediately sends one
  // real message asking the model to reproduce the existing spec via a real
  // tool call — see `buildResumeMessageText` — rather than faking prior
  // history client-side, which the backend would never actually see.
  // `initialProgress` seeds the new session from whatever was last saved
  // for it (a saved game's own stored progress — see `handleLaunchSavedGame`
  // — or the just-reloaded active session's, above); without this, a saved
  // game's persisted progress was written but never actually read back in.
  const startSession = useCallback(
    (
      spec: GameSpec,
      toolName: string,
      label: string,
      sessionId = crypto.randomUUID(),
      initialProgress?: unknown,
    ) => {
      if (sessions.has(sessionId)) {
        setState((prev) => ({ ...prev, activeSessionId: sessionId }));
        return;
      }
      const chat = new Chat<UIMessage>({ id: sessionId, transport, messages: [] });
      void chat.sendMessage({ text: buildResumeMessageText(toolName, label, spec) });
      setState((prev) => {
        const nextSessions = new Map(prev.sessions);
        nextSessions.set(sessionId, {
          id: sessionId,
          spec,
          origin: "menu",
          chat,
          progress: initialProgress,
        });
        return { ...prev, sessions: nextSessions, activeSessionId: sessionId };
      });
    },
    [transport, sessions],
  );

  // Launching a default game needs no intelligence, so this skips the model
  // entirely — see app/components/game-menu.tsx. Keyed by a stable
  // per-catalog-entry id (not a fresh random one) so clicking "Chess" again
  // after leaving for the menu resumes that same ongoing game, chat, and
  // progress — the same reuse `startSession` already does for saved games —
  // rather than resetting to a brand-new one every time.
  const handleSelectGame = useCallback(
    (id: CatalogGameId) => {
      const spec = defaultGameSpec(id);
      const toolName = id === "chess" ? "createChess" : "createNoughtsAndCrosses";
      const label = GAME_CATALOG.find((entry) => entry.id === id)?.title ?? spec.title;
      startSession(spec, toolName, label, `catalog-${id}`);
    },
    [startSession],
  );

  const handleExitGame = useCallback(async () => {
    await flushActiveProgress();
    setState((prev) => ({ ...prev, activeSessionId: null }));
  }, [flushActiveProgress]);

  // Saved custom games: kept in localStorage, not a database — this app has
  // no accounts, so "remember this on my device" is the right scope.
  // useSyncExternalStore (not a useEffect + setState) so the server-rendered
  // pass and the client's first paint both see the same empty snapshot —
  // reading localStorage during render would mismatch between them.
  const savedGames = useSyncExternalStore(
    subscribeSavedGames,
    getSavedGamesSnapshot,
    getSavedGamesServerSnapshot,
  );

  const handleSaveGame = useCallback((spec: CustomGameSpec) => {
    writeSavedGames([
      ...getSavedGamesSnapshot(),
      { id: crypto.randomUUID(), spec, savedAt: Date.now() },
    ]);
  }, []);

  const handleRemoveSavedGame = useCallback((id: string) => {
    writeSavedGames(getSavedGamesSnapshot().filter((saved) => saved.id !== id));
  }, []);

  // Called by whichever board is on screen whenever its progress changes
  // (a move, a tick worth resuming from). Kept on the session so it
  // survives a trip back to the menu; additionally mirrored into the saved
  // game's own localStorage entry when this session *is* a saved game
  // (its id doubles as the session id — see `handleLaunchSavedGame`), so
  // that progress also survives a page reload, not just navigating within
  // the app.
  const handleProgressChange = useCallback(
    (progress: unknown) => {
      setState((prev) => {
        if (!prev.activeSessionId) return prev;
        const existing = prev.sessions.get(prev.activeSessionId);
        if (!existing) return prev;
        const sessions = new Map(prev.sessions);
        sessions.set(prev.activeSessionId, { ...existing, progress });
        return { ...prev, sessions };
      });

      if (!activeSessionId) return;
      const current = getSavedGamesSnapshot();
      if (!current.some((saved) => saved.id === activeSessionId)) return;
      writeSavedGames(
        current.map((saved) => (saved.id === activeSessionId ? { ...saved, progress } : saved)),
      );
    },
    [activeSessionId],
  );

  // Keyed by the saved game's own stable id (not a fresh random one) so
  // relaunching the same library entry later this session resumes its
  // dedicated chat — including any edits already made to it — rather than
  // starting over blank each time.
  const handleLaunchSavedGame = useCallback(
    (saved: SavedGame) => {
      startSession(saved.spec, "createCustomGame", saved.spec.title, saved.id, saved.progress);
    },
    [startSession],
  );

  const game: ActiveGame | null = activeSession
    ? { id: activeSession.id, spec: activeSession.spec, origin: activeSession.origin }
    : null;

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <aside className="flex h-full w-1/3 min-w-0 flex-col border-r border-border bg-surface">
        <ChatPane
          key={activeChat.id}
          messages={messages}
          status={status}
          error={autoRetrying ? undefined : error}
          autoRetrying={autoRetrying}
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
          savedGames={savedGames}
          onLaunchSavedGame={handleLaunchSavedGame}
          onRemoveSavedGame={handleRemoveSavedGame}
          onSaveGame={handleSaveGame}
          initialProgress={activeSession?.progress}
          onProgressChange={handleProgressChange}
          onIframeWindowChange={handleIframeWindowChange}
        />
      </main>
    </div>
  );
}

/**
 * Applies a freshly-seen create-game tool call to workspace state: an edit
 * inside an existing game's own chat updates that session's spec in place,
 * while the lobby chat producing its first game claims that whole
 * conversation as the new game's dedicated chat and starts a fresh lobby
 * chat behind it for whatever gets described next.
 */
function applyToolCall(
  prev: WorkspaceState,
  found: { toolCallId: string; spec: GameSpec },
  transport: Transport,
): WorkspaceState {
  if (prev.activeSessionId) {
    const existing = prev.sessions.get(prev.activeSessionId);
    if (!existing) return prev;
    const sessions = new Map(prev.sessions);
    sessions.set(prev.activeSessionId, { ...existing, spec: found.spec });
    return { ...prev, sessions };
  }

  const sessionId = prev.lobbyChat.id;
  const sessions = new Map(prev.sessions);
  sessions.set(sessionId, {
    id: sessionId,
    spec: found.spec,
    origin: "chat",
    chat: prev.lobbyChat,
  });
  return { lobbyChat: makeChat(transport), sessions, activeSessionId: sessionId };
}

/**
 * Finds the newest completed create-game tool call in a conversation. The
 * tool output is validated rather than trusted — it originates from a model
 * call (or the synthetic seed above), and a spec that doesn't match the
 * schema should mean "no game found" instead of a crashed render.
 */
function latestToolCall(messages: UIMessage[]): { toolCallId: string; spec: GameSpec } | null {
  for (let m = messages.length - 1; m >= 0; m--) {
    const parts = messages[m].parts;
    for (let p = parts.length - 1; p >= 0; p--) {
      const part = parts[p];
      if (!isToolUIPart(part)) continue;
      if (!GAME_TOOL_NAMES.has(getToolName(part))) continue;
      if (part.state !== "output-available") continue;

      const parsed = gameSpecSchema.safeParse(part.output);
      if (parsed.success) {
        return { toolCallId: part.toolCallId, spec: parsed.data };
      }
    }
  }
  return null;
}
