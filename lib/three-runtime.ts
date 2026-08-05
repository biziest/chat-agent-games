/**
 * Shared by every board that renders agent-authored HTML in a sandboxed
 * iframe (custom-game-board.tsx, published-game-board.tsx): fetches the
 * vendored three.js bundle once and builds the final `srcDoc` with it (and
 * an optional resume-progress seed) inlined ahead of the model's own
 * script. See scripts/bundle-three.mjs for where the bundle comes from, and
 * the save/restore contract in trigger/chat.ts's system prompt for
 * `__initialProgress`.
 */

// Fetched once and reused for every game shown this session — the bundle is
// a static asset, not something that changes per game.
let threeSourcePromise: Promise<string> | null = null;
export function loadThreeSource(): Promise<string> {
  threeSourcePromise ??= fetch("/vendor/three.min.js").then((res) => res.text());
  return threeSourcePromise;
}

/** Escapes `<` so a JSON value can't break out of its enclosing <script> tag. */
function embedJson(value: unknown): string {
  return JSON.stringify(value ?? null).replace(/</g, "\\u003c");
}

/**
 * Inlines the three.js bundle (and `window.__initialProgress`, `null` when
 * there's nothing to resume) into `html`, right after its opening <head> —
 * or at the very start of the document if it has none.
 */
export function buildGameSrcDoc(
  html: string,
  threeSource: string,
  initialProgress: unknown = null,
): string {
  const script = `<script>window.__initialProgress=${embedJson(initialProgress)};${threeSource}</script>`;
  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch) {
    const index = headMatch.index + headMatch[0].length;
    return html.slice(0, index) + script + html.slice(index);
  }
  return script + html;
}
