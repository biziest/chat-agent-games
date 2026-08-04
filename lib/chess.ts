import { Chess, type Move, type Square } from "chess.js";
import type { ChessSpec } from "./game";

export type ChessDifficulty = ChessSpec["difficulty"];

const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

// A small center-control bonus per square, indexed [rank 0-7][file 0-7] with
// rank 0 = rank 1. Keeps a shallow search from looking aimless in quiet,
// materially-equal positions; it's a tiebreaker, not the main signal.
const CENTER_BONUS = [
  [0, 1, 2, 3, 3, 2, 1, 0],
  [1, 2, 3, 4, 4, 3, 2, 1],
  [2, 3, 4, 5, 5, 4, 3, 2],
  [3, 4, 5, 6, 6, 5, 4, 3],
  [3, 4, 5, 6, 6, 5, 4, 3],
  [2, 3, 4, 5, 5, 4, 3, 2],
  [1, 2, 3, 4, 4, 3, 2, 1],
  [0, 1, 2, 3, 3, 2, 1, 0],
];

const FILES = "abcdefgh";

/** Material + a small positional nudge, from White's perspective. */
function evaluate(chess: Chess): number {
  if (chess.isCheckmate()) {
    // `turn()` is whoever is to move next — i.e. whoever just got mated.
    return chess.turn() === "w" ? -100000 : 100000;
  }
  if (chess.isDraw() || chess.isStalemate()) return 0;

  let score = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const file = FILES.indexOf(piece.square[0]);
      const rank = Number(piece.square[1]) - 1;
      const value =
        PIECE_VALUE[piece.type] +
        (piece.type === "k" ? 0 : CENTER_BONUS[rank][file]);
      score += piece.color === "w" ? value : -value;
    }
  }
  return score;
}

/** Captures first — cheap, effective move ordering for alpha-beta pruning. */
function orderedMoves(chess: Chess): Move[] {
  const moves = chess.moves({ verbose: true });
  return [...moves].sort((a, b) => Number(b.isCapture()) - Number(a.isCapture()));
}

function applyMove(chess: Chess, move: Move): void {
  chess.move({ from: move.from, to: move.to, promotion: move.promotion });
}

/**
 * Negamax with alpha-beta pruning. `sign` is +1 when the side to move at the
 * root of this call is White, -1 for Black, so every recursive call can just
 * maximize its own score and negate on the way back up.
 *
 * Mutates `chess` via move()/undo() rather than cloning per node — cloning
 * would lose the move history chess.js needs for threefold-repetition
 * detection mid-search.
 */
function negamax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  sign: 1 | -1,
): number {
  if (chess.isCheckmate()) {
    // Prefer a sooner mate, or a later loss, over an equally-scored one
    // further down the tree — `depth` is plies remaining in the search.
    const mateScore = chess.turn() === "w" ? -100000 : 100000;
    return sign * (mateScore + (mateScore > 0 ? depth : -depth));
  }
  if (depth === 0 || chess.isGameOver()) {
    return sign * evaluate(chess);
  }

  let best = -Infinity;
  for (const move of orderedMoves(chess)) {
    applyMove(chess, move);
    const score = -negamax(chess, depth - 1, -beta, -alpha, (-sign) as 1 | -1);
    chess.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break; // beta cutoff
  }
  return best;
}

const SEARCH_DEPTH: Record<ChessDifficulty, number> = {
  easy: 0,
  medium: 2,
  hard: 3,
};

/**
 * Picks the computer's move for the position `chess` is currently in (it must
 * be the computer's turn). `easy` plays uniformly at random. `medium` and
 * `hard` run a depth-limited negamax search over material plus a small
 * center-control term — enough to take free material and spot short forced
 * mates, but not provably unbeatable the way the noughts-and-crosses search
 * is; chess isn't solved at any reachable depth.
 *
 * Returns null if the game is already over.
 */
export function chooseChessMove(
  chess: Chess,
  difficulty: ChessDifficulty,
): Move | null {
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) return null;
  if (difficulty === "easy") {
    return legal[Math.floor(Math.random() * legal.length)];
  }

  const depth = SEARCH_DEPTH[difficulty];
  const sign = chess.turn() === "w" ? 1 : -1;

  let best = legal[0];
  let bestScore = -Infinity;
  for (const move of orderedMoves(chess)) {
    applyMove(chess, move);
    const score = -negamax(chess, depth - 1, -Infinity, Infinity, (-sign) as 1 | -1);
    chess.undo();
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

/**
 * True when moving `from` -> `to` requires the player to choose a promotion
 * piece — i.e. more than one legal move shares that square pair, differing
 * only by `promotion`. The UI shows a picker in that case instead of moving
 * directly.
 */
export function needsPromotionChoice(
  chess: Chess,
  from: Square,
  to: Square,
): boolean {
  return chess
    .moves({ verbose: true })
    .some((move) => move.from === from && move.to === to && move.promotion);
}

export type ChessOutcome = "checkmate" | "stalemate" | "draw" | null;

export function chessOutcome(chess: Chess): ChessOutcome {
  if (chess.isCheckmate()) return "checkmate";
  if (chess.isStalemate()) return "stalemate";
  if (chess.isDraw()) return "draw";
  return null;
}

// Swapped from the "natural" Unicode mapping (U+2654-2659 for white,
// U+265A-265F for black) on purpose: the U+2654 set renders as hollow/outline
// shapes and reads as faint on a dark background, while the U+265A set is
// solid and reads clearly. Using the solid glyphs for the chess-logic-white
// side and the outline glyphs for chess-logic-black keeps both legible here —
// `piece.color`/`aria-label` elsewhere still say "white"/"black" correctly,
// this only changes which symbol represents each.
export const PIECE_GLYPH: Record<string, Record<"w" | "b", string>> = {
  p: { w: "♟", b: "♙" },
  n: { w: "♞", b: "♘" },
  b: { w: "♝", b: "♗" },
  r: { w: "♜", b: "♖" },
  q: { w: "♛", b: "♕" },
  k: { w: "♚", b: "♔" },
};

export const FILES_ORDER = FILES.split("");
export const RANKS_ORDER = ["8", "7", "6", "5", "4", "3", "2", "1"];

export type ChessOrientation = { ranks: string[]; files: string[] };

/**
 * Display order for ranks (top-to-bottom) and files (left-to-right) so the
 * human's own back rank is always nearest them — the standard convention: play
 * white and rank 1 is at the bottom with the a-file on your left; play black
 * and the board is rotated 180°, so rank 8 is at the bottom with the h-file on
 * your left.
 */
export function chessOrientation(human: "w" | "b"): ChessOrientation {
  return human === "w"
    ? { ranks: RANKS_ORDER, files: FILES_ORDER }
    : { ranks: [...RANKS_ORDER].reverse(), files: [...FILES_ORDER].reverse() };
}
