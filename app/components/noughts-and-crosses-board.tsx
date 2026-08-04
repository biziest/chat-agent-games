"use client";

import { useCallback, useEffect, useState } from "react";
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

export function NoughtsAndCrossesBoard({
  game,
}: {
  game: NoughtsAndCrossesSpec;
}) {
  const human = game.playerMark;
  const computer = other(human);

  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [turn, setTurn] = useState(() =>
    game.firstMove === "player" ? human : computer,
  );

  const won = findWinner(board);
  const draw = !won && isFull(board);
  const over = Boolean(won) || draw;

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
      const move = chooseMove(board, computer, game.difficulty);
      if (move !== null) play(move, computer);
    }, 420);
    return () => clearTimeout(timer);
  }, [board, turn, computer, over, game.difficulty, play]);

  const reset = () => {
    setBoard(EMPTY_BOARD);
    setTurn(game.firstMove === "player" ? human : computer);
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
      <header className="text-center">
        <h2 className="text-lg font-medium tracking-tight">{game.title}</h2>
        <p className="mt-1.5 text-xs text-muted">
          You are <span className="text-foreground">{human}</span> · computer is{" "}
          <span className="text-foreground">{computer}</span> ·{" "}
          <span className="text-foreground">{game.difficulty}</span>
        </p>
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
