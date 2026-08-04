"use client";

import { ChessBoard } from "@/app/components/chess-board";
import { GameMenu } from "@/app/components/game-menu";
import { NoughtsAndCrossesBoard } from "@/app/components/noughts-and-crosses-board";
import type { GameId, GameSpec } from "@/lib/game";

type Props = {
  game: { id: string; spec: GameSpec } | null;
  onSelectGame: (id: GameId) => void;
  onExitGame: () => void;
};

export function GamePane({ game, onSelectGame, onExitGame }: Props) {
  if (!game) return <GameMenu onSelect={onSelectGame} />;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onExitGame}
        className="absolute top-5 left-5 z-10 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
      >
        ← Games
      </button>
      <Board spec={game.spec} />
    </div>
  );
}

function Board({ spec }: { spec: GameSpec }) {
  switch (spec.kind) {
    case "noughts-and-crosses":
      return <NoughtsAndCrossesBoard game={spec} />;
    case "chess":
      return <ChessBoard game={spec} />;
  }
}
