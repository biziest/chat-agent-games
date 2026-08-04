"use client";

type Props = {
  value: "first" | "second";
  onChange: (value: "first" | "second") => void;
  disabled?: boolean;
  firstLabel?: string;
  secondLabel?: string;
};

const OPTIONS = ["first", "second"] as const;

/**
 * A two-way toggle for who moves first, shared by every game's board
 * component. Each board maps its own vocabulary onto "first"/"second" — e.g.
 * tic-tac-toe's `firstMove: "player" | "computer"`, chess's `playerColor`
 * (white always moves first in chess, so color *is* turn order).
 *
 * Pass `disabled` once the game has actually started: changing who goes
 * first mid-game would reassign whose pieces are whose, not just who's "up"
 * next, so every board only allows this before the first move.
 */
export function TurnOrderToggle({
  value,
  onChange,
  disabled = false,
  firstLabel = "Go first",
  secondLabel = "Go second",
}: Props) {
  return (
    <div>
      <p className="mb-1.5 text-center text-[11px] font-medium tracking-wide text-muted uppercase">
        Turn order
      </p>
      <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-xs">
        {OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={[
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              value === option
                ? "bg-accent text-accent-foreground"
                : "text-muted",
              disabled
                ? "cursor-not-allowed opacity-50"
                : value === option
                  ? ""
                  : "hover:text-foreground",
            ].join(" ")}
          >
            {option === "first" ? firstLabel : secondLabel}
          </button>
        ))}
      </div>
      {disabled ? (
        <p className="mt-1 text-center text-[10px] text-muted/70">
          Available again after Play Again
        </p>
      ) : null}
    </div>
  );
}
