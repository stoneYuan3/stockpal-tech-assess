import { describe, expect, it } from "vitest";
import { PENDING_TEXT, type Message } from "./dialogue";
import { buildExportText, exportFileName } from "./exportText";

const now = new Date(2026, 9, 31, 9, 5);
const messages: Message[] = [
  { id: "a", role: "worker", text: "We ran out of lemon" },
  { id: "b", role: "assistant", text: "Which milk?" },
  { id: "c", role: "worker", text: PENDING_TEXT },
  { id: "d", role: "system", text: "Session ended (idle)." },
];

describe("buildExportText", () => {
  it("lays out the report and dialogue with CRLF line endings", () => {
    expect(buildExportText(messages, ["Lemon", "Honey"], now)).toBe(
      [
        "86ing Pal dialogue",
        "Exported 2026-10-31 09:05",
        "",
        "Reported out:",
        "- Lemon",
        "- Honey",
        "",
        "Dialogue:",
        "Worker: We ran out of lemon",
        "Assistant: Which milk?",
        "[Session ended (idle).]",
        "",
      ].join("\r\n"),
    );
  });

  it("marks an empty report and skips pending placeholders", () => {
    const text = buildExportText(messages, [], now);
    expect(text).toContain("Reported out: (none)\r\n");
    expect(text).not.toContain(PENDING_TEXT);
  });
});

describe("exportFileName", () => {
  it("stamps the local date and time", () => {
    expect(exportFileName(now)).toBe("86ing-dialogue-2026-10-31-0905.txt");
  });
});
