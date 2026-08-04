"use client";

import { Chess, type Square } from "chess.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  chessOutcome,
  chooseChessMove,
  FILES_ORDER,
  needsPromotionChoice,
  PIECE_GLYPH,
  RANKS_ORDER,
} from "@/lib/chess";
import type { ChessSpec } from "@/lib/game";

type PromotionPiece = "q" | "r" | "b" | "n";
const PROMOTION_CHOICES: PromotionPiece[] = ["q", "r", "b", "n"];

type RecordedMove = { from: Square; to: Square; promotion?: PromotionPiece };

export function ChessBoard({ game }: { game: ChessSpec }) {
  const human = game.playerColor === "white" ? "w" : "b";
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

  const [selected, setSelected] = useState<Square | null>(null);
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

  const onSquareClick = (square: Square) => {
    if (over || turn !== human || pendingPromotion) return;

    if (selected === square) {
      setSelected(null);
      return;
    }

    if (selected && legalDestinations.has(square)) {
      if (needsPromotionChoice(chess, selected, square)) {
        setPendingPromotion({ from: selected, to: square });
        setSelected(null);
      } else {
        commitMove(selected, square);
      }
      return;
    }

    const piece = chess.get(square);
    setSelected(piece && piece.color === human ? square : null);
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
      const move = chooseChessMove(new Chess(chess.fen()), game.difficulty);
      if (move) {
        commitMove(move.from, move.to, move.promotion as PromotionPiece | undefined);
      }
    }, 420);
    return () => clearTimeout(timer);
  }, [chess, turn, over, computer, game.difficulty, commitMove]);

  const reset = () => {
    setHistory([]);
    setSelected(null);
    setLastMove(null);
    setPendingPromotion(null);
  };

  const ranks = human === "w" ? RANKS_ORDER : [...RANKS_ORDER].reverse();
  const files = human === "w" ? FILES_ORDER : [...FILES_ORDER].reverse();

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
      <header className="text-center">
        <h2 className="text-lg font-medium tracking-tight">{game.title}</h2>
        <p className="mt-1.5 text-xs text-muted">
          You are{" "}
          <span className="text-foreground">{game.playerColor}</span> ·{" "}
          <span className="text-foreground">{game.difficulty}</span>
        </p>
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

              return (
                <button
                  key={square}
                  type="button"
                  onClick={() => onSquareClick(square)}
                  aria-label={`${square}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
                  className={[
                    "relative flex size-12 items-center justify-center text-3xl transition-colors",
                    light ? "bg-surface" : "bg-surface-raised",
                    selectable ? "ring-2 ring-accent ring-inset" : "",
                    inCheck ? "bg-red-500/20" : "",
                    isLastMove && !selectable && !inCheck ? "bg-accent/10" : "",
                  ].join(" ")}
                >
                  {piece ? PIECE_GLYPH[piece.type][piece.color] : null}
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
