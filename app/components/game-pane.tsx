"use client";

import { ChessBoard } from "@/app/components/chess-board";
import { CustomGameBoard } from "@/app/components/custom-game-board";
import { GameMenu } from "@/app/components/game-menu";
import { NoughtsAndCrossesBoard } from "@/app/components/noughts-and-crosses-board";
import type { CatalogGameId, CustomGameSpec, GameSpec } from "@/lib/game";
import type { SavedGame } from "@/lib/saved-games";

type ActiveGame = { id: string; spec: GameSpec; origin: "chat" | "menu" };

type Props = {
  game: ActiveGame | null;
  onSelectGame: (id: CatalogGameId) => void;
  onExitGame: () => void;
  savedGames: SavedGame[];
  onLaunchSavedGame: (saved: SavedGame) => void;
  onRemoveSavedGame: (id: string) => void;
  onSaveGame: (spec: CustomGameSpec) => void;
  initialProgress: unknown;
  onProgressChange: (progress: unknown) => void;
  onIframeWindowChange: (win: Window | null) => void;
};

export function GamePane({
  game,
  onSelectGame,
  onExitGame,
  savedGames,
  onLaunchSavedGame,
  onRemoveSavedGame,
  onSaveGame,
  initialProgress,
  onProgressChange,
  onIframeWindowChange,
}: Props) {
  if (!game) {
    return (
      <GameMenu
        onSelect={onSelectGame}
        savedGames={savedGames}
        onLaunchSaved={onLaunchSavedGame}
        onRemoveSaved={onRemoveSavedGame}
      />
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onExitGame}
        className="absolute top-5 left-5 z-10 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
      >
        ← Games
      </button>
      <Board
        game={game}
        onSaveGame={onSaveGame}
        initialProgress={initialProgress}
        onProgressChange={onProgressChange}
        onIframeWindowChange={onIframeWindowChange}
      />
    </div>
  );
}

function Board({
  game,
  onSaveGame,
  initialProgress,
  onProgressChange,
  onIframeWindowChange,
}: {
  game: ActiveGame;
  onSaveGame: (spec: CustomGameSpec) => void;
  initialProgress: unknown;
  onProgressChange: (progress: unknown) => void;
  onIframeWindowChange: (win: Window | null) => void;
}) {
  const { spec, origin } = game;
  switch (spec.kind) {
    case "noughts-and-crosses":
      return (
        <NoughtsAndCrossesBoard
          game={spec}
          initialProgress={initialProgress}
          onProgressChange={onProgressChange}
        />
      );
    case "chess":
      return (
        <ChessBoard
          game={spec}
          initialProgress={initialProgress}
          onProgressChange={onProgressChange}
        />
      );
    case "custom":
      return (
        <CustomGameBoard
          game={spec}
          // Only a game just generated this session is offered a save —
          // one already launched from the menu is either curated (nothing
          // to save) or already in the library.
          offerSave={origin === "chat"}
          onSave={() => onSaveGame(spec)}
          initialProgress={initialProgress}
          onProgressChange={onProgressChange}
          onIframeWindowChange={onIframeWindowChange}
        />
      );
  }
}
