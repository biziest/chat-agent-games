"use client";

import { useId, useState } from "react";

/**
 * Shared "type yes to confirm" modal for the app's irreversible actions
 * (deleting a saved game in game-menu.tsx, unpublishing a game here and in
 * custom-game-board.tsx/published-game-board.tsx) — a misplaced tap on a
 * small × or "Unpublish" button shouldn't be enough on its own.
 */
export function TypeToConfirmModal({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [text, setText] = useState("");
  const inputId = useId();
  const confirmed = text.trim().toLowerCase() === "yes";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${inputId}-title`}
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-border bg-surface p-5"
      >
        <h3 id={`${inputId}-title`} className="text-sm font-medium text-foreground">
          {title}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-muted">{description}</p>
        <input
          id={inputId}
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && confirmed) onConfirm();
            if (event.key === "Escape") onCancel();
          }}
          placeholder="yes"
          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-red-500/40"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!confirmed}
            className="rounded-lg bg-red-500/90 px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
