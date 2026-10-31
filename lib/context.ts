import { PENDING_TEXT, type Message } from "./dialogue";
import type { Ingredient } from "./ingredients";

// Caps the token cost of replaying a long shift into each new session.
export const CONTEXT_MESSAGE_LIMIT = 20;

const SPEAKER = { worker: "Worker", assistant: "Assistant" } as const;

// Earlier records become one system message, so a new session can follow up
// on them without re-reporting anything.
export function buildContext(
  messages: readonly Message[],
  reported: readonly Ingredient[],
): string | null {
  const lines = messages
    .filter(
      (message): message is Message & { role: keyof typeof SPEAKER } =>
        message.role !== "system" && message.text !== PENDING_TEXT,
    )
    .slice(-CONTEXT_MESSAGE_LIMIT)
    .map(({ role, text }) => `${SPEAKER[role]}: ${text}`);
  if (lines.length === 0 && reported.length === 0) return null;

  const parts = [
    "Context from earlier conversations in this shift. Use it only to understand follow-ups; do not report from it.",
  ];
  if (reported.length > 0) {
    parts.push(`Already reported out: ${reported.join(", ")}.`);
  }
  if (lines.length > 0) parts.push(["Earlier dialogue:", ...lines].join("\n"));
  return parts.join("\n\n");
}
