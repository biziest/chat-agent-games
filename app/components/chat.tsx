"use client";

import { useChat } from "@ai-sdk/react";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import { isReasoningUIPart, isTextUIPart } from "ai";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { mintChatAccessToken, startChatSession } from "@/app/actions";
// Type-only: erased at build time, so the server-only agent module never
// reaches the client bundle. It gives the transport a compile-time check on the
// task id and the message shape.
import type { chatAgent } from "@/trigger/chat";

export function Chat() {
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

  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  // `useChat`'s own stop() doesn't reach the backend once a stream has been
  // reconnected, so signal the run directly and then settle the local state.
  const stop = useCallback(() => {
    void transport.stopGeneration(chatId);
    aiStop();
  }, [transport, chatId, aiStop]);

  const submit = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      const text = input.trim();
      if (!text || busy) return;
      setInput("");
      void sendMessage({ text });
    },
    [input, busy, sendMessage],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-5 py-4">
        <StatusDot status={status} />
        <h1 className="text-sm font-medium tracking-tight">Agent</h1>
        <span className="ml-auto font-mono text-[11px] text-muted">
          chat-agent
        </span>
      </header>

      <MessageList messages={messages} status={status} />

      {error ? (
        <div className="mx-4 mb-3 shrink-0 rounded-lg border border-red-500/25 bg-red-500/8 px-3.5 py-3 text-xs text-red-300">
          <p className="font-medium">Something went wrong</p>
          <p className="mt-1 text-red-300/70">{error.message}</p>
          <button
            type="button"
            onClick={clearError}
            className="mt-2 text-red-200 underline decoration-red-400/40 underline-offset-2 hover:decoration-red-300"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <form
        onSubmit={submit}
        className="shrink-0 border-t border-border bg-surface p-4"
      >
        <div className="rounded-xl border border-border bg-surface-raised transition-colors focus-within:border-accent/40">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Ask the agent something…"
            className="scrollbar-slim block max-h-40 w-full resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted/70"
          />
          <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
            <span className="text-[11px] text-muted/70">
              <kbd className="font-sans">⏎</kbd> to send
            </span>
            {busy ? (
              <button
                type="button"
                onClick={stop}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/5"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function MessageList({
  messages,
  status,
}: {
  messages: ReturnType<typeof useChat>["messages"];
  status: ReturnType<typeof useChat>["status"];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  // Follow the stream, but stop fighting the user once they scroll away.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="scrollbar-slim min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5"
    >
      {messages.length === 0 ? (
        <p className="pt-6 text-sm leading-relaxed text-muted">
          This chat runs as a durable Trigger.dev task. Send a message to start
          the session — it survives refreshes, deploys, and run boundaries.
        </p>
      ) : null}

      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}

      {status === "submitted" ? (
        <p className="text-xs text-muted">Waking the agent…</p>
      ) : null}
    </div>
  );
}

function Message({
  message,
}: {
  message: ReturnType<typeof useChat>["messages"][number];
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-border bg-surface-raised px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
          {message.parts.filter(isTextUIPart).map((part, i) => (
            <span key={i}>{part.text}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {message.parts.map((part, i) => {
        if (isReasoningUIPart(part)) {
          if (!part.text) return null;
          return (
            <details
              key={i}
              className="rounded-lg border border-border bg-surface/60 px-3 py-2"
            >
              <summary className="cursor-pointer text-[11px] font-medium tracking-wide text-muted uppercase">
                Thinking
              </summary>
              <div className="mt-2 text-xs leading-relaxed whitespace-pre-wrap text-muted">
                {part.text}
              </div>
            </details>
          );
        }

        if (isTextUIPart(part)) {
          return (
            <div
              key={i}
              className="text-sm leading-relaxed whitespace-pre-wrap text-foreground"
            >
              {part.text}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

function StatusDot({
  status,
}: {
  status: ReturnType<typeof useChat>["status"];
}) {
  const tone =
    status === "streaming" || status === "submitted"
      ? "bg-accent"
      : status === "error"
        ? "bg-red-400"
        : "bg-muted/50";

  return (
    <span className="relative flex size-2">
      {status === "streaming" ? (
        <span className="absolute inline-flex size-2 animate-ping rounded-full bg-accent opacity-60" />
      ) : null}
      <span className={`relative inline-flex size-2 rounded-full ${tone}`} />
    </span>
  );
}
