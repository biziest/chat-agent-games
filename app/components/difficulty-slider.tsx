"use client";

type Level<D extends string> = { value: D; label: string };

type Props<D extends string> = {
  levels: readonly Level<D>[];
  value: D;
  onChange: (level: D) => void;
};

/** A discrete slider over a small, ordered set of difficulty levels — shared by
 * every game's board component so difficulty always looks and behaves the
 * same, regardless of what the levels are called for that game. */
export function DifficultySlider<D extends string>({
  levels,
  value,
  onChange,
}: Props<D>) {
  const index = Math.max(
    0,
    levels.findIndex((level) => level.value === value),
  );

  return (
    <div className="w-48">
      <p className="mb-1.5 text-center text-[11px] font-medium tracking-wide text-muted uppercase">
        Difficulty
      </p>
      <input
        type="range"
        min={0}
        max={levels.length - 1}
        step={1}
        value={index}
        onChange={(event) =>
          onChange(levels[Number(event.target.value)].value)
        }
        aria-label="Difficulty"
        className="w-full accent-accent"
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        {levels.map((level) => (
          <span
            key={level.value}
            className={
              level.value === value ? "font-medium text-foreground" : ""
            }
          >
            {level.label}
          </span>
        ))}
      </div>
    </div>
  );
}
