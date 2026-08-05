"use client";

import {
  getToolName,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type ChatStatus,
  type UIMessage,
} from "ai";
import { GAME_TOOL_NAMES } from "@/lib/game";
import { parseResumeMessageText } from "@/lib/resume-message";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

type Props = {
  messages: UIMessage[];
  status: ChatStatus;
  error: Error | undefined;
  onSend: (text: string) => void;
  onStop: () => void;
  onDismissError: () => void;
  // Regenerates the failed turn — a deliberate, user-initiated action only.
  // Retrying automatically used to live here (see workspace.tsx's history)
  // but caused more problems than it solved.
  onRetry: () => void;
};

export function ChatPane({
  messages,
  status,
  error,
  onSend,
  onStop,
  onDismissError,
  onRetry,
}: Props) {
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    onSend(text);
  };

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
        <h1 className="text-sm font-medium tracking-tight">Game builder</h1>
        <span className="ml-auto font-mono text-[11px] text-muted">
          chat-agent
        </span>
      </header>

      <MessageList messages={messages} status={status} />

      {error ? (
        <div className="mx-4 mb-3 shrink-0 rounded-lg border border-red-500/25 bg-red-500/8 px-3.5 py-3 text-xs text-red-300">
          <p className="font-medium">Something went wrong</p>
          <p className="mt-1 text-red-300/70">{error.message}</p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="text-red-200 underline decoration-red-400/40 underline-offset-2 hover:decoration-red-300"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={onDismissError}
              className="text-red-200 underline decoration-red-400/40 underline-offset-2 hover:decoration-red-300"
            >
              Dismiss
            </button>
          </div>
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
            placeholder="Describe a game…"
            className="scrollbar-slim block max-h-40 w-full resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted/70"
          />
          <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
            <span className="text-[11px] text-muted/70">
              <kbd className="font-sans">⏎</kbd> to send
            </span>
            {busy ? (
              <button
                type="button"
                onClick={onStop}
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
  messages: UIMessage[];
  status: ChatStatus;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  // Follow the stream, but stop fighting the user once they scroll away.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
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
      {messages.length === 0 ? <Suggestions /> : null}

      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}

      {status === "submitted" ? (
        <p className="text-xs text-muted">Waking the agent…</p>
      ) : null}
    </div>
  );
}

function Suggestions() {
  return (
    <div className="pt-4">
      <p className="text-sm leading-relaxed text-muted">
        Describe any game — it&rsquo;ll appear on the right, playable, no
        code or new tab needed.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-foreground/80">
        <li>&ldquo;Create a simple game like tic tac toe&rdquo;</li>
        <li>&ldquo;Make me a game where I dodge falling blocks&rdquo;</li>
        <li>&ldquo;A memory-matching card game with a timer&rdquo;</li>
      </ul>
    </div>
  );
}

function Message({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    // Launching a game from the menu/library sends one real message asking
    // the model to reproduce its exact spec (see lib/resume-message.ts) —
    // technically necessary, but not something the player actually said, so
    // it renders as a small status badge instead of a raw JSON chat bubble.
    const resumeText = message.parts.filter(isTextUIPart).map((part) => part.text).join("");
    const resume = parseResumeMessageText(resumeText);
    if (resume) {
      return (
        <div className="flex justify-center">
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-muted">
            ↻ Resumed {resume.label}
          </span>
        </div>
      );
    }

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

        if (isToolUIPart(part) && GAME_TOOL_NAMES.has(getToolName(part))) {
          const done = part.state === "output-available";
          return (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2 text-xs text-muted"
            >
              <span
                className={`size-1.5 rounded-full ${done ? "bg-accent" : "animate-pulse bg-muted"}`}
              />
              {done ? "Built the game →" : "Building the game…"}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

function StatusDot({ status }: { status: ChatStatus }) {
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
