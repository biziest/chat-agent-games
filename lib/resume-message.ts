import type { GameSpec } from "./game";

/**
 * Marks the first message of a chat that's resuming an existing game
 * (launched from the menu or the saved library) rather than describing a
 * new one.
 *
 * A dedicated chat needs the model to actually know the game's exact
 * spec/HTML so it can act on real edit requests afterward — but the
 * chat.agent backend only durably remembers turns that were genuinely sent
 * through it (its history is reconstructed server-side from what actually
 * happened, not from whatever a client claims happened). So there's no way
 * to just splice fake prior messages into a fresh session's display and
 * have the model see them — this sends one real, working turn instead,
 * asking the model to call the matching tool with the exact existing spec.
 * See the matching instructions in trigger/chat.ts's system prompt, and the
 * display override in chat-pane.tsx that keeps this out of the visible
 * transcript.
 */
export const RESUME_MARKER = "[[resume-game]]";

type ResumePayload = { tool: string; label: string; input: unknown };

export function buildResumeMessageText(toolName: string, label: string, spec: GameSpec): string {
  // Strip the discriminant — it's not part of any tool's actual input
  // schema, and the whole point is handing the model exactly what it would
  // pass to the tool itself.
  const input = Object.fromEntries(Object.entries(spec).filter(([key]) => key !== "kind"));
  const payload: ResumePayload = { tool: toolName, label, input };
  return `${RESUME_MARKER} ${JSON.stringify(payload)}`;
}

export function parseResumeMessageText(text: string): { label: string } | null {
  if (!text.startsWith(RESUME_MARKER)) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(RESUME_MARKER.length).trim());
    if (
      parsed &&
      typeof parsed === "object" &&
      "label" in parsed &&
      typeof (parsed as { label: unknown }).label === "string"
    ) {
      return { label: (parsed as { label: string }).label };
    }
    return null;
  } catch {
    return null;
  }
}
