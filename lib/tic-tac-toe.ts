import type { NoughtsAndCrossesSpec } from "./game";

export type Mark = "X" | "O";
export type Cell = Mark | null;
export type Board = Cell[]; // always length 9

export const EMPTY_BOARD: Board = Array(9).fill(null);

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function other(mark: Mark): Mark {
  return mark === "X" ? "O" : "X";
}

export function findWinner(
  board: Board,
): { mark: Mark; line: readonly number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) return { mark, line };
  }
  return null;
}

export function availableMoves(board: Board): number[] {
  const moves: number[] = [];
  for (let i = 0; i < board.length; i++) if (!board[i]) moves.push(i);
  return moves;
}

export function isFull(board: Board): boolean {
  return board.every(Boolean);
}

/** Score is from `me`'s perspective; earlier wins score higher. */
function minimax(board: Board, me: Mark, turn: Mark, depth: number): number {
  const won = findWinner(board);
  if (won) return won.mark === me ? 10 - depth : depth - 10;
  if (isFull(board)) return 0;

  const scores = availableMoves(board).map((move) => {
    const next = board.slice();
    next[move] = turn;
    return minimax(next, me, other(turn), depth + 1);
  });

  return turn === me ? Math.max(...scores) : Math.min(...scores);
}

function bestMove(board: Board, me: Mark): number {
  const moves = availableMoves(board);
  let best = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const next = board.slice();
    next[move] = me;
    const score = minimax(next, me, other(me), 1);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  return best;
}

function randomMove(board: Board): number {
  const moves = availableMoves(board);
  return moves[Math.floor(Math.random() * moves.length)];
}

/**
 * Picks the computer's move. `perfect` is full minimax and cannot be beaten;
 * `medium` plays it half the time; `easy` is random.
 *
 * Called from event handlers / effects only — it uses Math.random, so calling it
 * during render would desync hydration.
 */
export function chooseMove(
  board: Board,
  me: Mark,
  difficulty: NoughtsAndCrossesSpec["difficulty"],
): number | null {
  if (availableMoves(board).length === 0) return null;
  if (difficulty === "easy") return randomMove(board);
  if (difficulty === "medium" && Math.random() < 0.5) return randomMove(board);
  return bestMove(board, me);
}
