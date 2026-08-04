import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  availableMoves,
  chooseMove,
  EMPTY_BOARD,
  findWinner,
  isFull,
  other,
  type Board,
  type Mark,
} from "./tic-tac-toe.ts";

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

describe("findWinner", () => {
  it("detects all eight lines", () => {
    for (const line of LINES) {
      const board: Board = EMPTY_BOARD.slice();
      for (const i of line) board[i] = "X";
      assert.equal(findWinner(board)?.mark, "X", `line ${line.join("")}`);
    }
  });

  it("returns null for an empty board", () => {
    assert.equal(findWinner(EMPTY_BOARD), null);
  });

  it("does not false-positive on a full drawn board", () => {
    const drawn: Board = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
    assert.equal(findWinner(drawn), null);
    assert.ok(isFull(drawn));
  });
});

/** Plays a full game; returns the winning mark or "draw". */
function playOut(
  pick: (board: Board, turn: Mark) => number,
  opening: Mark,
): Mark | "draw" {
  let board: Board = EMPTY_BOARD.slice();
  let turn = opening;
  for (;;) {
    const won = findWinner(board);
    if (won) return won.mark;
    if (isFull(board)) return "draw";
    board = board.slice();
    board[pick(board, turn)] = turn;
    turn = other(turn);
  }
}

const randomPick = (board: Board) => {
  const moves = availableMoves(board);
  return moves[Math.floor(Math.random() * moves.length)];
};

describe("chooseMove: perfect", () => {
  it("never loses to a random opponent", () => {
    // The whole point of minimax here: tic-tac-toe is a solved game, so a
    // correct implementation cannot be beaten from either opening. 60 games per
    // opening keeps this a few seconds; raise it if you touch the search.
    for (const opening of ["X", "O"] as const) {
      for (let i = 0; i < 60; i++) {
        const result = playOut(
          (board, turn) =>
            turn === "O" ? chooseMove(board, turn, "perfect")! : randomPick(board),
          opening,
        );
        assert.notEqual(result, "X", `random beat perfect (opening ${opening})`);
      }
    }
  });

  it("draws against itself from either opening", () => {
    for (const opening of ["X", "O"] as const) {
      const result = playOut(
        (board, turn) => chooseMove(board, turn, "perfect")!,
        opening,
      );
      assert.equal(result, "draw");
    }
  });

  it("takes an immediate win", () => {
    const board: Board = ["X", "X", null, "O", "O", null, null, null, null];
    assert.equal(chooseMove(board, "X", "perfect"), 2);
  });

  it("blocks an immediate loss", () => {
    const board: Board = ["O", "O", null, "X", null, null, null, null, null];
    assert.equal(chooseMove(board, "X", "perfect"), 2);
  });
});

describe("chooseMove: easy", () => {
  it("is not secretly optimal", () => {
    const board: Board = ["O", "O", null, "X", null, null, null, null, null];
    const moves = new Set<number | null>();
    for (let i = 0; i < 200; i++) moves.add(chooseMove(board, "X", "easy"));
    assert.ok(moves.size > 1, "easy always played the same move");
  });
});

describe("chooseMove: any difficulty", () => {
  it("returns null on a full board", () => {
    const full: Board = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
    for (const d of ["easy", "medium", "perfect"] as const) {
      assert.equal(chooseMove(full, "X", d), null);
    }
  });

  it("only ever returns an empty square", () => {
    const board: Board = ["X", null, "O", null, "X", null, "O", null, null];
    for (const d of ["easy", "medium", "perfect"] as const) {
      for (let i = 0; i < 100; i++) {
        const move = chooseMove(board, "X", d);
        assert.equal(board[move!], null, `${d} picked an occupied square`);
      }
    }
  });
});
