"use client";

import { Chess, type Square } from "chess.js";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
} from "react";
import { DifficultySlider } from "@/app/components/difficulty-slider";
import { TurnOrderToggle } from "@/app/components/turn-order-toggle";
import {
  chessOrientation,
  chessOutcome,
  chooseChessMove,
  needsPromotionChoice,
  PIECE_GLYPH,
} from "@/lib/chess";
import type { ChessSpec } from "@/lib/game";

type PromotionPiece = "q" | "r" | "b" | "n";
const PROMOTION_CHOICES: PromotionPiece[] = ["q", "r", "b", "n"];

const DIFFICULTY_LEVELS: { value: ChessSpec["difficulty"]; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

type RecordedMove = { from: Square; to: Square; promotion?: PromotionPiece };

export function ChessBoard({ game }: { game: ChessSpec }) {
  // Local, not part of the spec: both controls adjust these without needing
  // the agent. Difficulty only affects the *next* computer move, so it's
  // safe to change live. Color can't be applied to the position in
  // progress — white always moves first in chess, so this is also "who goes
  // first," and it would reassign whose pieces are whose — so changing it
  // resets the game; see `handlePlayerColorChange` below.
  const [playerColor, setPlayerColor] = useState(game.playerColor);
  const [difficulty, setDifficulty] = useState(game.difficulty);

  const human = playerColor === "white" ? "w" : "b";
  const computer = human === "w" ? "b" : "w";

  // The move list is the source of truth, not a live engine instance: React's
  // rules forbid reading a ref during render, and chess.js's own repetition
  // detection needs the full history anyway, which a bare `new Chess(fen)`
  // per move would lose. `chess` below replays that history on demand.
  const [history, setHistory] = useState<RecordedMove[]>([]);
  const chess = useMemo(() => {
    const c = new Chess();
    for (const move of history) c.move(move);
    return c;
  }, [history]);
  const gameStarted = history.length > 0;

  const [selected, setSelected] = useState<Square | null>(null);
  const [dragOverSquare, setDragOverSquare] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(
    null,
  );
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const turn = chess.turn();
  const result = chessOutcome(chess);
  const over = result !== null;
  const check = chess.isCheck();

  const legalDestinations = useMemo(() => {
    if (!selected) return new Set<Square>();
    return new Set(
      chess.moves({ verbose: true, square: selected }).map((m) => m.to),
    );
  }, [chess, selected]);

  const commitMove = useCallback(
    (from: Square, to: Square, promotion?: PromotionPiece) => {
      setLastMove({ from, to });
      setSelected(null);
      setPendingPromotion(null);
      setHistory((prev) => [...prev, { from, to, promotion }]);
    },
    [],
  );

  // Shared by click-to-move and drag-and-drop. Checks legality itself rather
  // than trusting the memoized `legalDestinations` (which is keyed on
  // `selected` state) so a drop is validated against the actual current
  // position regardless of any render timing between drag start and drop.
  const tryMove = useCallback(
    (from: Square, to: Square) => {
      const legal = chess
        .moves({ verbose: true, square: from })
        .some((m) => m.to === to);
      if (!legal) return false;

      if (needsPromotionChoice(chess, from, to)) {
        setPendingPromotion({ from, to });
        setSelected(null);
      } else {
        commitMove(from, to);
      }
      return true;
    },
    [chess, commitMove],
  );

  const onSquareClick = (square: Square) => {
    if (over || turn !== human || pendingPromotion) return;

    if (selected === square) {
      setSelected(null);
      return;
    }

    if (selected && tryMove(selected, square)) return;

    const piece = chess.get(square);
    setSelected(piece && piece.color === human ? square : null);
  };

  const onSquareDragOver = (event: DragEvent, square: Square) => {
    event.preventDefault(); // required for onDrop to fire at all
    if (dragOverSquare !== square) setDragOverSquare(square);
  };

  const onSquareDrop = (event: DragEvent, square: Square) => {
    event.preventDefault();
    setDragOverSquare(null);
    const from = event.dataTransfer.getData("text/plain") as Square | "";
    if (from) tryMove(from, square);
    setSelected(null);
  };

  const onPieceDragEnd = () => {
    setSelected(null);
    setDragOverSquare(null);
  };

  // The computer's turn. Delayed slightly so its move reads as a response
  // rather than appearing in the same frame as the player's. The search runs
  // on its own scratch instance built from the current position — not because
  // `chess` is a ref (it isn't, it's a plain memoized value), but because
  // `chooseChessMove` mutates via move()/undo() internally, which would
  // otherwise mutate a value this render is also reading. That scratch copy
  // has no move history, so its own internal repetition checks are scoped to
  // its few-ply search tree, not the real game — moot in practice, since a
  // 2-3 ply lookahead can't complete an actual threefold repetition anyway.
  useEffect(() => {
    if (over || turn !== computer) return;
    const timer = setTimeout(() => {
      const move = chooseChessMove(new Chess(chess.fen()), difficulty);
      if (move) {
        commitMove(move.from, move.to, move.promotion as PromotionPiece | undefined);
      }
    }, 420);
    return () => clearTimeout(timer);
  }, [chess, turn, over, computer, difficulty, commitMove]);

  const reset = () => {
    setHistory([]);
    setSelected(null);
    setLastMove(null);
    setPendingPromotion(null);
  };

  // Switching color reassigns whose pieces are whose, so it always starts a
  // fresh game rather than trying to reinterpret the position in progress.
  const handlePlayerColorChange = (value: "first" | "second") => {
    setPlayerColor(value === "first" ? "white" : "black");
    reset();
  };

  const { ranks, files } = chessOrientation(human);

  const status = pendingPromotion
    ? "Choose a promotion"
    : result === "checkmate"
      ? turn === human
        ? "Checkmate — computer wins"
        : "Checkmate — you win"
      : result === "stalemate"
        ? "Draw by stalemate"
        : result === "draw"
          ? "Draw"
          : turn === human
            ? check
              ? "Check — your turn"
              : "Your turn"
            : "Computer thinking…";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7 p-10">
      <header className="flex flex-col items-center gap-4 text-center">
        <div>
          <h2 className="text-lg font-medium tracking-tight">{game.title}</h2>
          <p className="mt-1.5 text-xs text-muted">
            You are <span className="text-foreground">{playerColor}</span>
          </p>
        </div>
        <div className="flex items-start gap-6">
          <TurnOrderToggle
            value={playerColor === "white" ? "first" : "second"}
            onChange={handlePlayerColorChange}
            firstLabel="Play white"
            secondLabel="Play black"
            note={gameStarted ? "Starts a new game" : undefined}
          />
          <DifficultySlider
            levels={DIFFICULTY_LEVELS}
            value={difficulty}
            onChange={setDifficulty}
          />
        </div>
      </header>

      <div className="relative">
        <div className="grid grid-cols-8 overflow-hidden rounded-xl border border-border">
          {ranks.map((rank) =>
            files.map((file) => {
              const square = `${file}${rank}` as Square;
              const piece = chess.get(square);
              const light = chess.squareColor(square) === "light";
              const selectable = selected === square;
              const destination = legalDestinations.has(square);
              const isLastMove =
                lastMove && (lastMove.from === square || lastMove.to === square);
              const inCheck =
                check && piece?.type === "k" && piece.color === turn;
              const draggablePiece =
                piece?.color === human &&
                !over &&
                turn === human &&
                !pendingPromotion;
              const hoveredForDrop = dragOverSquare === square && destination;

              return (
                <button
                  key={square}
                  type="button"
                  onClick={() => onSquareClick(square)}
                  onDragOver={(event) => onSquareDragOver(event, square)}
                  onDrop={(event) => onSquareDrop(event, square)}
                  aria-label={`${square}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
                  className={[
                    "relative flex size-12 items-center justify-center text-3xl transition-colors",
                    light ? "bg-surface-raised" : "bg-surface",
                    selectable ? "ring-2 ring-accent ring-inset" : "",
                    inCheck ? "bg-red-500/20" : "",
                    isLastMove && !selectable && !inCheck ? "bg-accent/10" : "",
                    hoveredForDrop ? "bg-accent/20" : "",
                  ].join(" ")}
                >
                  {piece ? (
                    <span
                      draggable={draggablePiece}
                      onDragStart={(event) => {
                        if (!draggablePiece) {
                          event.preventDefault();
                          return;
                        }
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", square);
                        setSelected(square);
                      }}
                      onDragEnd={onPieceDragEnd}
                      className={
                        draggablePiece
                          ? "cursor-grab select-none active:cursor-grabbing"
                          : "select-none"
                      }
                    >
                      {PIECE_GLYPH[piece.type][piece.color]}
                    </span>
                  ) : null}
                  {destination ? (
                    <span
                      className={
                        piece
                          ? "pointer-events-none absolute inset-1 rounded-sm ring-2 ring-accent/70"
                          : "pointer-events-none absolute size-2.5 rounded-full bg-accent/60"
                      }
                    />
                  ) : null}
                </button>
              );
            }),
          )}
        </div>

        {pendingPromotion ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/90">
            <div className="rounded-xl border border-border bg-surface-raised p-4 text-center">
              <p className="mb-3 text-xs text-muted">Promote to</p>
              <div className="flex gap-2">
                {PROMOTION_CHOICES.map((piece) => (
                  <button
                    key={piece}
                    type="button"
                    onClick={() =>
                      pendingPromotion &&
                      commitMove(
                        pendingPromotion.from,
                        pendingPromotion.to,
                        piece,
                      )
                    }
                    className="flex size-11 items-center justify-center rounded-lg border border-border bg-surface text-2xl transition-colors hover:bg-white/5"
                  >
                    {PIECE_GLYPH[piece][human]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
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
