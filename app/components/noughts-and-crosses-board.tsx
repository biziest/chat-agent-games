"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
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

const progressSchema = z.object({
  board: z.array(z.enum(["X", "O"]).nullable()).length(9),
  turn: z.enum(["X", "O"]),
  firstMove: z.enum(["player", "computer"]),
  difficulty: z.enum(["easy", "medium", "perfect"]),
});

type Progress = {
  board: Board;
  turn: Mark;
  firstMove: NoughtsAndCrossesSpec["firstMove"];
  difficulty: NoughtsAndCrossesSpec["difficulty"];
};

/**
 * Validates rather than trusts `initialProgress` — it round-trips through
 * `onProgressChange` into either in-memory session state or a saved game's
 * localStorage entry (see workspace.tsx), and a stale or hand-edited blob
 * shouldn't crash the board. Falls back to a fresh game.
 */
function loadProgress(raw: unknown, game: NoughtsAndCrossesSpec): Progress {
  const parsed = progressSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return {
    board: EMPTY_BOARD,
    turn: game.firstMove === "player" ? game.playerMark : other(game.playerMark),
    firstMove: game.firstMove,
    difficulty: game.difficulty,
  };
}

export function NoughtsAndCrossesBoard({
  game,
  initialProgress,
  onProgressChange,
}: {
  game: NoughtsAndCrossesSpec;
  initialProgress?: unknown;
  onProgressChange: (progress: unknown) => void;
}) {
  const human = game.playerMark;
  const computer = other(human);

  const [initial] = useState(() => loadProgress(initialProgress, game));

  // Local, not part of the spec: both controls adjust these without needing
  // the agent. Difficulty only affects the *next* computer move, so it's
  // safe to change live. Who goes first can't be applied to the game in
  // progress — it would reassign whose pieces are whose — so changing it
  // resets the board; see `handleFirstMoveChange` below.
  const [firstMove, setFirstMove] = useState(initial.firstMove);
  const [difficulty, setDifficulty] = useState(initial.difficulty);

  const [board, setBoard] = useState<Board>(initial.board);
  const [turn, setTurn] = useState<Mark>(initial.turn);

  // Reports the resumable state up to the parent whenever it changes, so
  // leaving for the menu and coming back (or, for a saved game, reloading
  // the page) picks up where this left off — see `initialProgress` above and
  // the comment on `GameSession.progress` in workspace.tsx.
  useEffect(() => {
    onProgressChange({ board, turn, firstMove, difficulty });
  }, [board, turn, firstMove, difficulty, onProgressChange]);

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

  // Changing who goes first reassigns whose pieces are whose, so it always
  // starts a fresh board rather than trying to reinterpret the game in
  // progress. Computes `turn` from `next` directly rather than reading back
  // `firstMove` state, which wouldn't have updated yet in this same tick.
  const handleFirstMoveChange = (value: "first" | "second") => {
    const next = value === "first" ? "player" : "computer";
    setFirstMove(next);
    setBoard(EMPTY_BOARD);
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
            note={gameStarted ? "Starts a new game" : undefined}
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
