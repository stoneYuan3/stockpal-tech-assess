import { PENDING_TEXT, type Message } from "./dialogue";
import type { Ingredient } from "./ingredients";

const SPEAKER = { worker: "Worker", assistant: "Assistant" } as const;

const pad = (n: number) => String(n).padStart(2, "0");
const date = (now: Date) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const time = (now: Date) => `${pad(now.getHours())}:${pad(now.getMinutes())}`;

// CRLF so the file reads cleanly in Windows Notepad as well as on phones.
export function buildExportText(
  messages: readonly Message[],
  reported: readonly Ingredient[],
  now: Date,
): string {
  const lines = [
    "86ing Pal dialogue",
    `Exported ${date(now)} ${time(now)}`,
    "",
    ...(reported.length > 0
      ? ["Reported out:", ...reported.map((name) => `- ${name}`)]
      : ["Reported out: (none)"]),
    "",
    "Dialogue:",
    ...messages
      .filter(({ text }) => text !== PENDING_TEXT)
      .map(({ role, text }) =>
        role === "system" ? `[${text}]` : `${SPEAKER[role]}: ${text}`,
      ),
  ];
  return lines.join("\r\n") + "\r\n";
}

export function exportFileName(now: Date): string {
  return `86ing-dialogue-${date(now)}-${time(now).replace(":", "")}.txt`;
}
