"use client";

type Props = {
  value: "first" | "second";
  onChange: (value: "first" | "second") => void;
  firstLabel?: string;
  secondLabel?: string;
  note?: string;
};

const OPTIONS = ["first", "second"] as const;

/**
 * A two-way toggle for who moves first, shared by every game's board
 * component. Each board maps its own vocabulary onto "first"/"second" — e.g.
 * tic-tac-toe's `firstMove: "player" | "computer"`, chess's `playerColor`
 * (white always moves first in chess, so color *is* turn order).
 *
 * Always takes effect immediately, however far into a game you are — the
 * calling board restarts its own game state alongside the preference, since
 * reassigning who's playing which side mid-game isn't otherwise coherent.
 * Pass `note` to surface that ("Starts a new game") when it matters.
 */
export function TurnOrderToggle({
  value,
  onChange,
  firstLabel = "Go first",
  secondLabel = "Go second",
  note,
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
            onClick={() => onChange(option)}
            className={[
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              value === option
                ? "bg-accent text-accent-foreground"
                : "text-muted hover:text-foreground",
            ].join(" ")}
          >
            {option === "first" ? firstLabel : secondLabel}
          </button>
        ))}
      </div>
      {note ? (
        <p className="mt-1 text-center text-[10px] text-muted/70">{note}</p>
      ) : null}
    </div>
  );
}
