"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { listGameReviews, submitGameRating } from "@/app/actions";
import type { GameReview, PublishedGame } from "@/lib/published-games";
import { buildGameSrcDoc, loadThreeSource } from "@/lib/three-runtime";

// One rating per game per browser, enforced client-side only — see the
// comment on submitGameRating in app/actions.ts for why there's nothing
// stronger without accounts.
const ratedKey = (gameId: string) => `chat-agent-games:rated:${gameId}`;

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
  const [reviews, setReviews] = useState<GameReview[]>([]);
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

  useEffect(() => {
    let cancelled = false;
    void listGameReviews(game.id).then((fetched) => {
      if (!cancelled) setReviews(fetched);
    });
    return () => {
      cancelled = true;
    };
  }, [game.id]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
      <header className="text-center">
        <h2 className="text-lg font-medium tracking-tight">{game.title}</h2>
        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-muted">
          <StarDisplay value={game.ratingAverage ?? 0} />
          <span>
            {game.ratingAverage ? game.ratingAverage.toFixed(1) : "No ratings yet"}
            {game.ratingCount > 0 ? ` (${game.ratingCount})` : ""}
          </span>
        </div>
      </header>

      {threeSource ? (
        <iframe
          ref={iframeRef}
          title={game.title}
          srcDoc={buildGameSrcDoc(game.html, threeSource)}
          sandbox="allow-scripts"
          className="min-h-[50vh] flex-1 rounded-xl border border-border"
        />
      ) : (
        <div className="flex min-h-[50vh] flex-1 items-center justify-center rounded-xl border border-border text-sm text-muted">
          Loading graphics engine…
        </div>
      )}

      <RatingForm gameId={game.id} onSubmitted={(review) => setReviews((prev) => [review, ...prev])} />

      {reviews.length > 0 ? (
        <div className="mx-auto w-full max-w-md space-y-2.5">
          <h3 className="text-xs font-medium tracking-wide text-muted uppercase">
            Reviews
          </h3>
          {reviews.map((review) => (
            <div key={review.id} className="rounded-lg border border-border bg-surface px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <StarDisplay value={review.rating} />
                <span className="text-xs text-muted">{review.reviewerName || "Anonymous"}</span>
              </div>
              {review.comment ? (
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{review.comment}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RatingForm({
  gameId,
  onSubmitted,
}: {
  gameId: string;
  onSubmitted: (review: GameReview) => void;
}) {
  const [alreadyRated, setAlreadyRated] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(ratedKey(gameId)) === "1",
  );
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "error">("idle");

  if (alreadyRated) {
    return (
      <p className="text-center text-xs text-muted">You&rsquo;ve already rated this game — thanks!</p>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!rating || submitState === "submitting") return;
    setSubmitState("submitting");
    try {
      await submitGameRating({
        gameId,
        rating,
        reviewerName: name.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      window.localStorage.setItem(ratedKey(gameId), "1");
      setAlreadyRated(true);
      onSubmitted({
        id: crypto.randomUUID(),
        rating,
        reviewerName: name.trim() || null,
        comment: comment.trim() || null,
        createdAt: Date.now(),
      });
    } catch {
      setSubmitState("error");
    }
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="mx-auto w-full max-w-md space-y-2.5 rounded-lg border border-border bg-surface p-4"
    >
      <p className="text-sm font-medium text-foreground">Rate this game</p>
      <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            onMouseEnter={() => setHoverRating(value)}
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
            className="text-2xl leading-none transition-transform hover:scale-110"
          >
            <span className={(hoverRating || rating) >= value ? "text-accent" : "text-border"}>★</span>
          </button>
        ))}
      </div>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Your name (optional)"
        maxLength={60}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/40"
      />
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="What did you think? (optional)"
        rows={2}
        maxLength={2000}
        className="scrollbar-slim w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/40"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!rating || submitState === "submitting"}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {submitState === "submitting" ? "Submitting…" : "Submit review"}
        </button>
        {submitState === "error" ? (
          <span className="text-xs text-red-300">Couldn&rsquo;t submit — try again.</span>
        ) : null}
      </div>
    </form>
  );
}

export function StarDisplay({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <span aria-hidden className="text-sm">
      <span className="text-accent">{"★".repeat(rounded)}</span>
      <span className="text-border">{"★".repeat(5 - rounded)}</span>
    </span>
  );
}
