"use client";

import { useEffect, useRef, useState } from "react";
import { unpublishGame } from "@/app/actions";
import { TypeToConfirmModal } from "@/app/components/type-to-confirm-modal";
import type { PublishedGame } from "@/lib/published-games";
import { isPublishedByMe, unmarkPublishedByMe } from "@/lib/published-game-tracking";
import { buildGameSrcDoc, loadThreeSource } from "@/lib/three-runtime";

/**
 * Plays a game someone else published to the shared gallery. Read-only —
 * unlike your own games, there's no dedicated chat behind a community game
 * to send edit requests to (see lib/resume-message.ts's contract, which
 * assumes the model already built the exact spec being resumed), and no
 * per-visitor progress persistence yet either. Both are reasonable follow-ups
 * if this turns out to matter, not fundamental limits.
 */
export function PublishedGameBoard({
  game,
  onUnpublished,
}: {
  game: PublishedGame;
  // Called after a successful unpublish — the game is gone, so whoever's
  // showing this needs to navigate back to the menu; nothing left to render.
  onUnpublished: () => void;
}) {
  const [threeSource, setThreeSource] = useState<string | null>(null);
  const [showUnpublishPrompt, setShowUnpublishPrompt] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // This only ever mounts client-side, well after hydration (reaching a
  // community game always requires a prior click — see workspace.tsx's
  // handleSelectPublished) — never during the server-rendered pass or the
  // client's matching first render — so reading localStorage directly here
  // is safe, unlike the hydration-mismatch trap in workspace.tsx's history.
  const canUnpublish = isPublishedByMe(game.id);

  useEffect(() => {
    let cancelled = false;
    void loadThreeSource().then((source) => {
      if (!cancelled) setThreeSource(source);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUnpublish = async () => {
    setShowUnpublishPrompt(false);
    await unpublishGame(game.id);
    unmarkPublishedByMe(game.id);
    onUnpublished();
  };

  return (
    <div className="flex flex-1 flex-col gap-3 p-6">
      <header className="text-center">
        <h2 className="text-lg font-medium tracking-tight">{game.title}</h2>
        <p className="mt-1 text-xs text-muted">
          {game.authorName ? `by ${game.authorName}` : "Anonymous"} ·{" "}
          {new Date(game.publishedAt).toLocaleDateString()}
        </p>
        {canUnpublish ? (
          <button
            type="button"
            onClick={() => setShowUnpublishPrompt(true)}
            className="mt-1.5 text-xs text-muted underline decoration-red-400/40 underline-offset-2 hover:text-red-300 hover:decoration-red-300"
          >
            Unpublish game
          </button>
        ) : null}
      </header>

      {threeSource ? (
        <iframe
          ref={iframeRef}
          title={game.title}
          srcDoc={buildGameSrcDoc(game.html, threeSource)}
          sandbox="allow-scripts"
          className="min-h-0 flex-1 rounded-xl border border-border"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border text-sm text-muted">
          Loading graphics engine…
        </div>
      )}

      {showUnpublishPrompt ? (
        <TypeToConfirmModal
          title={`Unpublish "${game.title}"?`}
          description="It'll be removed from the community gallery for everyone. This can't be undone. Type yes to confirm."
          confirmLabel="Unpublish"
          onCancel={() => setShowUnpublishPrompt(false)}
          onConfirm={() => void handleUnpublish()}
        />
      ) : null}
    </div>
  );
}
