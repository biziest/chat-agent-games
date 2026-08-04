import { anthropic } from "@ai-sdk/anthropic";
import { chat } from "@trigger.dev/sdk/ai";
import { stepCountIs, streamText } from "ai";

const SYSTEM_PROMPT = `You are the assistant embedded in a Next.js app.

The user sees you in a chat panel on the left of the screen. A larger main area
sits to the right; it is currently a placeholder that the developer will fill in
later, so don't claim to be able to draw into it yet.

Keep responses focused, brief, and concise to avoid overwhelming the person.
Disclaimers and caveats are brief, with most of the response on the main answer;
when asked to explain something, give a high-level summary unless an in-depth
one is specifically requested.

The chat pane is narrow. Prefer short paragraphs and tight lists over wide
tables or long code blocks.`;

/**
 * The chat agent. `run` is invoked once per conversational turn with the full
 * accumulated history already converted to `ModelMessage[]`, and the
 * `StreamTextResult` we return is piped straight to the browser.
 */
export const chatAgent = chat.agent({
  id: "chat-agent",
  // Stay warm for 5 minutes between turns so follow-up messages don't pay a
  // cold start. The session outlives the run either way.
  idleTimeoutInSeconds: 300,
  run: async ({ messages, tools, signal }) =>
    streamText({
      // Spread this FIRST: it wires up prepareStep (compaction, steering,
      // background injection), the system prompt set via chat.prompt(), and
      // telemetry. Explicit options below intentionally win.
      ...chat.toStreamTextOptions({ tools }),
      model: anthropic("claude-opus-5"),
      system: SYSTEM_PROMPT,
      messages,
      abortSignal: signal,
      stopWhen: stepCountIs(15),
      providerOptions: {
        anthropic: {
          // Thinking is on by default on Opus 5, but `display` defaults to
          // "omitted" — which reads as a long pause in a streaming UI. Ask for
          // the summary so the chat can render reasoning as it arrives.
          thinking: { type: "adaptive", display: "summarized" },
          effort: "high",
          // Safety classifiers can decline a request outright. Let the API
          // re-run it on the recommended fallback model instead of surfacing a
          // dead turn to the user.
          fallbacks: "default",
        },
      },
    }),
});
