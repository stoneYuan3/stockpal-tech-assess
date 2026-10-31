export type Message = {
  id: string;
  role: "worker" | "assistant" | "system";
  text: string;
};

// Transcripts arrive after later events, so a message keeps the slot it was
// first given and only its text is replaced.
export function upsertMessage(
  messages: readonly Message[],
  message: Message,
): Message[] {
  const index = messages.findIndex(({ id }) => id === message.id);
  if (index === -1) return [...messages, message];
  return messages.map((existing, i) => (i === index ? message : existing));
}

export function appendToMessage(
  messages: readonly Message[],
  id: string,
  role: Message["role"],
  delta: string,
): Message[] {
  const existing = messages.find((message) => message.id === id);
  return upsertMessage(messages, {
    id,
    role,
    text: (existing?.text ?? "") + delta,
  });
}

export const PENDING_TEXT = "…";

// Adds a message only if its id is new, so a late placeholder never
// overwrites text that has already arrived.
export function ensureMessage(
  messages: readonly Message[],
  message: Message,
): Message[] {
  if (messages.some(({ id }) => id === message.id)) return [...messages];
  return [...messages, message];
}

// The first transcript delta replaces the placeholder instead of following it.
export function appendTranscriptDelta(
  messages: readonly Message[],
  id: string,
  delta: string,
): Message[] {
  const existing = messages.find((message) => message.id === id);
  const base = existing?.text === PENDING_TEXT ? "" : (existing?.text ?? "");
  return upsertMessage(messages, { id, role: "worker", text: base + delta });
}
