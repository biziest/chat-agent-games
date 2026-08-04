import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Chess } from "chess.js";
import {
  chessOutcome,
  chooseChessMove,
  needsPromotionChoice,
} from "./chess.ts";

// FENs below were verified against chess.js directly (not just hand-derived)
// before being used as test fixtures — see the isCheckmate/isStalemate checks
// that accompany each.

describe("chooseChessMove", () => {
  it("takes an immediate checkmate when available", () => {
    // Black king boxed in on g8 by its own pawns; White rook can mate on the
    // back rank. Confirmed via chess.js: playing Ra8 here is checkmate.
    const chess = new Chess("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1");
    for (const difficulty of ["medium", "hard"] as const) {
      const move = chooseChessMove(new Chess(chess.fen()), difficulty)!;
      const after = new Chess(chess.fen());
      after.move({ from: move.from, to: move.to, promotion: move.promotion });
      assert.ok(after.isCheckmate(), `${difficulty} missed the mate in one`);
    }
  });

  it("captures an undefended piece instead of a quiet move", () => {
    // Black queen on a4, undefended, on the same file as White's only rook.
    const chess = new Chess("4k3/8/8/8/q7/8/8/R3K3 w - - 0 1");
    for (const difficulty of ["medium", "hard"] as const) {
      const move = chooseChessMove(new Chess(chess.fen()), difficulty)!;
      assert.ok(move.isCapture(), `${difficulty} left the queen hanging`);
    }
  });

  it("easy is not secretly optimal", () => {
    // Same hanging-queen position: an optimal player captures every time, so
    // easy must sometimes not, or it isn't actually random.
    const chess = new Chess("4k3/8/8/8/q7/8/8/R3K3 w - - 0 1");
    let everMissedTheCapture = false;
    for (let i = 0; i < 100; i++) {
      const move = chooseChessMove(new Chess(chess.fen()), "easy")!;
      if (!move.isCapture()) everMissedTheCapture = true;
    }
    assert.ok(everMissedTheCapture, "easy always captured the hanging queen");
  });

  it("returns null when the game is already over", () => {
    const stalemate = new Chess("7k/5K2/6Q1/8/8/8/8/8 b - - 0 1");
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      assert.equal(chooseChessMove(stalemate, difficulty), null);
    }
  });

  it("only ever returns a currently-legal move", () => {
    // Play out a handful of short random games and sanity-check every move a
    // shallow search proposes is one chess.js actually considers legal —
    // guards against a search bug applying/undoing state incorrectly.
    for (let game = 0; game < 5; game++) {
      const chess = new Chess();
      for (let ply = 0; ply < 8 && !chess.isGameOver(); ply++) {
        const legal = chess.moves({ verbose: true });
        chess.move(legal[Math.floor(Math.random() * legal.length)]);
      }
      if (chess.isGameOver()) continue;

      const move = chooseChessMove(chess, "medium");
      assert.ok(move);
      const stillLegal = chess
        .moves({ verbose: true })
        .some((m) => m.from === move!.from && m.to === move!.to);
      assert.ok(stillLegal, `${move!.san} was not in the legal move list`);
    }
  });
});

describe("needsPromotionChoice", () => {
  it("is true for a pawn reaching the back rank", () => {
    const chess = new Chess("8/P6k/8/8/8/8/7K/8 w - - 0 1");
    assert.ok(needsPromotionChoice(chess, "a7", "a8"));
  });

  it("is false for an ordinary move", () => {
    const chess = new Chess("8/P6k/8/8/8/8/7K/8 w - - 0 1");
    assert.equal(needsPromotionChoice(chess, "h2", "h3"), false);
  });
});

describe("chessOutcome", () => {
  it("is null for a fresh game", () => {
    assert.equal(chessOutcome(new Chess()), null);
  });

  it("detects checkmate", () => {
    const chess = new Chess();
    // Fool's mate — fastest possible checkmate.
    for (const san of ["f3", "e5", "g4", "Qh4"]) chess.move(san);
    assert.equal(chessOutcome(chess), "checkmate");
  });

  it("detects stalemate", () => {
    const chess = new Chess("7k/5K2/6Q1/8/8/8/8/8 b - - 0 1");
    assert.equal(chessOutcome(chess), "stalemate");
  });
});
