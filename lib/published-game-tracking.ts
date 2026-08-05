/**
 * Tracks which published games *this browser* published, so the app can
 * show an "Unpublish" option only to the apparent publisher. There are no
 * accounts anywhere in this app, so this is a soft, client-side courtesy —
 * not an enforced permission — the same trust level as the rest of the app
 * (see the "one rating per browser" note that used to live here before
 * ratings were removed, and lib/saved-games.ts generally).
 */
const STORAGE_KEY = "chat-agent-games:published-by-me";

function readIds(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function markPublishedByMe(id: string): void {
  const ids = readIds();
  if (ids.includes(id)) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, id]));
}

export function unmarkPublishedByMe(id: string): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(readIds().filter((existing) => existing !== id)));
}

export function isPublishedByMe(id: string): boolean {
  if (typeof window === "undefined") return false;
  return readIds().includes(id);
}
