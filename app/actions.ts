"use server";

import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";

/**
 * Creates the durable Session row and triggers the first run, returning the
 * session-scoped public token. Idempotent on (env, chatId), so concurrent calls
 * converge on the same session.
 *
 * This is where per-user authorization would live — the browser never sees the
 * environment's secret key.
 */
export const startChatSession = chat.createStartSessionAction("chat-agent");

/**
 * Mints a fresh session-scoped token for an existing chat. The transport calls
 * this on a 401/403 to refresh.
 */
export async function mintChatAccessToken(chatId: string) {
  return auth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  });
}
