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
  type ReactNode,
} from "react";

// Shown above the input once a game exists — one tap sends a common edit
// request instead of typing it out. Deliberately generic (not per-genre):
// they read sensibly for any game, curated or custom.
const QUICK_EDITS = [
  "Make it harder",
  "Change the color scheme",
  "Add sound effects",
  "Make it faster-paced",
];

const STARTER_PROMPTS = [
  "Create a simple game like tic tac toe",
  "Make me a game where I dodge falling blocks",
  "A memory-matching card game with a timer",
];

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
  // Hides this pane so the game can fill the screen — see workspace.tsx,
  // which keeps the chat and its history running regardless.
  onCollapse: () => void;
  // Whether a game is currently on screen — swaps the starter prompts for
  // quick-edit chips relevant to something that already exists.
  hasActiveGame: boolean;
};

export function ChatPane({
  messages,
  status,
  error,
  onSend,
  onStop,
  onDismissError,
  onRetry,
  onCollapse,
  hasActiveGame,
}: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  const submit = (event?: FormEvent, text = input) => {
    event?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    onSend(trimmed);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  // Grows with content up to the CSS max-height (then scrolls) — reset to
  // "auto" first so shrinking (e.g. after sending) recalculates correctly
  // instead of only ever growing.
  const onInput = (event: FormEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-5 py-4">
        <StatusDot status={status} />
        <h1 className="text-sm font-medium tracking-tight">Game builder</h1>
        <span className="ml-auto font-mono text-[11px] text-muted">
          chat-agent
        </span>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse chat"
          title="Collapse chat"
          className="rounded-lg border border-border px-2 py-1 text-xs text-muted transition-colors hover:bg-white/5 hover:text-foreground"
        >
          «
        </button>
      </header>

      <MessageList messages={messages} status={status} onSuggestion={(text) => submit(undefined, text)} />

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
        {hasActiveGame && !busy ? (
          <div className="scrollbar-slim mb-2.5 flex gap-1.5 overflow-x-auto pb-1">
            {QUICK_EDITS.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => submit(undefined, text)}
                className="shrink-0 rounded-full border border-border bg-surface-raised px-3 py-1 text-xs text-muted transition-colors hover:border-accent/40 hover:text-foreground"
              >
                {text}
              </button>
            ))}
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-surface-raised transition-colors focus-within:border-accent/40">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onInput={onInput}
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
  onSuggestion,
}: {
  messages: UIMessage[];
  status: ChatStatus;
  onSuggestion: (text: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  // Follow the stream, but stop fighting the user once they scroll away —
  // and surface a "jump to latest" button while they're away from the
  // bottom, since a long streaming reply can otherwise scroll on without
  // them noticing.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    pinnedRef.current = pinned;
    setShowJumpToLatest(!pinned);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    pinnedRef.current = true;
    setShowJumpToLatest(false);
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scrollbar-slim h-full space-y-5 overflow-y-auto px-5 py-5"
      >
        {messages.length === 0 ? <Suggestions onPick={onSuggestion} /> : null}

        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}

        {status === "submitted" ? <TypingIndicator /> : null}
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-surface-raised px-3 py-1 text-[11px] text-muted shadow-lg transition-colors hover:text-foreground"
        >
          ↓ Jump to latest
        </button>
      ) : null}
    </div>
  );
}

function Suggestions({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="animate-message-in pt-4">
      <p className="text-sm leading-relaxed text-muted">
        Describe any game — it&rsquo;ll appear on the right, playable, no
        code or new tab needed.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {STARTER_PROMPTS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onPick(text)}
            className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-left text-sm text-foreground/80 transition-colors hover:border-accent/40 hover:bg-surface-raised hover:text-foreground"
          >
            &ldquo;{text}&rdquo;
          </button>
        ))}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="animate-message-in flex items-center gap-2">
      <Avatar />
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-surface-raised px-3.5 py-3">
        <span className="animate-typing-dot size-1.5 rounded-full bg-muted [animation-delay:0ms]" />
        <span className="animate-typing-dot size-1.5 rounded-full bg-muted [animation-delay:150ms]" />
        <span className="animate-typing-dot size-1.5 rounded-full bg-muted [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-xs">
      ✦
    </span>
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
        <div className="animate-message-in flex justify-center">
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-muted">
            ↻ Resumed {resume.label}
          </span>
        </div>
      );
    }

    return (
      <div className="animate-message-in flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-border bg-surface-raised px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
          {message.parts.filter(isTextUIPart).map((part, i) => (
            <span key={i}>{part.text}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-message-in flex items-start gap-2">
      <Avatar />
      <div className="min-w-0 flex-1 space-y-2.5">
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
                className="rounded-2xl rounded-bl-md border border-border bg-surface-raised px-3.5 py-2.5 text-sm leading-relaxed text-foreground"
              >
                {renderInlineMarkdown(part.text)}
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
    </div>
  );
}

/**
 * A small, safe subset of markdown — bold, inline code, and fenced code
 * blocks — rendered as real React elements (never `dangerouslySetInnerHTML`,
 * so there's no injection risk from anything the model writes). The system
 * prompt asks for terse replies, so this is about the occasional `variable
 * name` or **emphasis**, not full document rendering.
 */
function renderInlineMarkdown(text: string): ReactNode {
  const blocks = text.split(/(```[\s\S]*?```)/g);
  return blocks.map((block, blockIndex) => {
    if (block.startsWith("```")) {
      const code = block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
      return (
        <pre
          key={blockIndex}
          className="scrollbar-slim my-1.5 overflow-x-auto rounded-lg bg-black/30 px-3 py-2 font-mono text-xs"
        >
          <code>{code}</code>
        </pre>
      );
    }

    const segments = block.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g);
    return (
      <span key={blockIndex} className="whitespace-pre-wrap">
        {segments.map((segment, i) => {
          if (segment.startsWith("**") && segment.endsWith("**")) {
            return <strong key={i}>{segment.slice(2, -2)}</strong>;
          }
          if (segment.startsWith("`") && segment.endsWith("`")) {
            return (
              <code key={i} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em]">
                {segment.slice(1, -1)}
              </code>
            );
          }
          return <span key={i}>{segment}</span>;
        })}
      </span>
    );
  });
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
