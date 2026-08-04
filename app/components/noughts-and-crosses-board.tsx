"use client";

import { useCallback, useEffect, useState } from "react";
import { DifficultySlider } from "@/app/components/difficulty-slider";
import { TurnOrderToggle } from "@/app/components/turn-order-toggle";
import type { NoughtsAndCrossesSpec } from "@/lib/game";
import {
  chooseMove,
  EMPTY_BOARD,
  findWinner,
  isFull,
  other,
  type Board,
  type Mark,
} from "@/lib/tic-tac-toe";

const DIFFICULTY_LEVELS: {
  value: NoughtsAndCrossesSpec["difficulty"];
  label: string;
}[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "perfect", label: "Perfect" },
];

export function NoughtsAndCrossesBoard({
  game,
}: {
  game: NoughtsAndCrossesSpec;
}) {
  const human = game.playerMark;
  const computer = other(human);

  // Local, not part of the spec: both controls adjust these live, without
  // needing the agent. Difficulty only affects the *next* computer move, so
  // it's safe to change anytime. Who goes first can't be — it would reassign
  // whose pieces are whose mid-game — so it's only settable while the board
  // is still empty; see `gameStarted` below.
  const [firstMove, setFirstMove] = useState(game.firstMove);
  const [difficulty, setDifficulty] = useState(game.difficulty);

  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [turn, setTurn] = useState(() =>
    firstMove === "player" ? human : computer,
  );

  const won = findWinner(board);
  const draw = !won && isFull(board);
  const over = Boolean(won) || draw;
  const gameStarted = board.some((cell) => cell !== null);

  const play = useCallback((square: number, mark: Mark) => {
    setBoard((prev) => {
      if (prev[square]) return prev;
      const next = prev.slice();
      next[square] = mark;
      return next;
    });
    setTurn(other(mark));
  }, []);

  // The computer's turn. Delayed slightly so its move reads as a response
  // rather than appearing in the same frame as the player's.
  useEffect(() => {
    if (over || turn !== computer) return;
    const timer = setTimeout(() => {
      const move = chooseMove(board, computer, difficulty);
      if (move !== null) play(move, computer);
    }, 420);
    return () => clearTimeout(timer);
  }, [board, turn, computer, over, difficulty, play]);

  const reset = () => {
    setBoard(EMPTY_BOARD);
    setTurn(firstMove === "player" ? human : computer);
  };

  // Reachable only while `gameStarted` is false — the toggle disables itself
  // otherwise — so it's always safe to also move `turn` immediately.
  const handleFirstMoveChange = (value: "first" | "second") => {
    const next = value === "first" ? "player" : "computer";
    setFirstMove(next);
    setTurn(next === "player" ? human : computer);
  };

  const status = won
    ? won.mark === human
      ? "You win"
      : "Computer wins"
    : draw
      ? "Draw"
      : turn === human
        ? "Your turn"
        : "Computer thinking…";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7 p-10">
      <header className="flex flex-col items-center gap-4 text-center">
        <div>
          <h2 className="text-lg font-medium tracking-tight">{game.title}</h2>
          <p className="mt-1.5 text-xs text-muted">
            You are <span className="text-foreground">{human}</span> · computer
            is <span className="text-foreground">{computer}</span>
          </p>
        </div>
        <div className="flex items-start gap-6">
          <TurnOrderToggle
            value={firstMove === "player" ? "first" : "second"}
            onChange={handleFirstMoveChange}
            disabled={gameStarted}
          />
          <DifficultySlider
            levels={DIFFICULTY_LEVELS}
            value={difficulty}
            onChange={setDifficulty}
          />
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {board.map((cell, i) => {
          const winning = won?.line.includes(i) ?? false;
          const playable = !cell && !over && turn === human;

          return (
            <button
              key={i}
              type="button"
              onClick={() => playable && play(i, human)}
              disabled={!playable}
              aria-label={`Square ${i + 1}${cell ? `, ${cell}` : ", empty"}`}
              className={[
                "flex size-24 items-center justify-center rounded-xl border text-4xl font-semibold transition-colors",
                winning
                  ? "border-accent/60 bg-accent/10"
                  : "border-border bg-surface",
                playable ? "cursor-pointer hover:bg-surface-raised" : "",
                cell === "X" ? "text-accent" : "text-foreground",
              ].join(" ")}
            >
              {cell}
            </button>
          );
        })}
      </div>

      <footer className="flex min-h-9 items-center gap-4">
        <span
          className={`text-sm ${over ? "font-medium text-foreground" : "text-muted"}`}
        >
          {status}
        </span>
        {over ? (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            Play again
          </button>
        ) : null}
      </footer>
    </div>
  );
}
