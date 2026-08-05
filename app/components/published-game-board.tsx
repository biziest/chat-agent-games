"use client";

import { useEffect, useRef, useState } from "react";
import type { PublishedGame } from "@/lib/published-games";
import { buildGameSrcDoc, loadThreeSource } from "@/lib/three-runtime";

/**
 * Plays a game someone else published to the shared gallery. Read-only —
 * unlike your own games, there's no dedicated chat behind a community game
 * to send edit requests to (see lib/resume-message.ts's contract, which
 * assumes the model already built the exact spec being resumed), and no
 * per-visitor progress persistence yet either. Both are reasonable follow-ups
 * if this turns out to matter, not fundamental limits.
 */
export function PublishedGameBoard({ game }: { game: PublishedGame }) {
  const [threeSource, setThreeSource] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    void loadThreeSource().then((source) => {
      if (!cancelled) setThreeSource(source);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-3 p-6">
      <header className="text-center">
        <h2 className="text-lg font-medium tracking-tight">{game.title}</h2>
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
    </div>
  );
}
