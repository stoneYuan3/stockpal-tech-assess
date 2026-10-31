import { describe, expect, it } from "vitest";
import { buildContext, CONTEXT_MESSAGE_LIMIT } from "./context";
import { PENDING_TEXT, type Message } from "./dialogue";

const worker: Message = { id: "a", role: "worker", text: "No milk" };
const reply: Message = { id: "b", role: "assistant", text: "Which milk?" };
const notice: Message = { id: "c", role: "system", text: "Session ended." };

describe("buildContext", () => {
  it("returns null when there is nothing to carry over", () => {
    expect(buildContext([], [])).toBeNull();
    expect(buildContext([notice], [])).toBeNull();
  });

  it("labels speakers and lists what was reported", () => {
    const context = buildContext([worker, reply], ["Lemon", "Honey"]);
    expect(context).toContain("Already reported out: Lemon, Honey.");
    expect(context).toContain(
      "Earlier dialogue:\nWorker: No milk\nAssistant: Which milk?",
    );
  });

  it("skips system notices and pending placeholders", () => {
    const pending = { id: "d", role: "worker", text: PENDING_TEXT } as const;
    const context = buildContext([notice, worker, pending], []);
    expect(context).not.toContain("Session ended.");
    expect(context).not.toContain(PENDING_TEXT);
    expect(context).not.toContain("Already reported out");
  });

  it("sends a report without dialogue", () => {
    const context = buildContext([], ["Lemon"]);
    expect(context).toContain("Already reported out: Lemon.");
    expect(context).not.toContain("Earlier dialogue");
  });

  it("keeps only the most recent messages", () => {
    const many = Array.from({ length: CONTEXT_MESSAGE_LIMIT + 5 }, (_, i) => ({
      id: String(i),
      role: "worker" as const,
      text: `line ${i}`,
    }));
    const context = buildContext(many, [])!;
    expect(context).not.toContain("line 4\n");
    expect(context).toContain("line 5\n");
    expect(context.match(/^Worker:/gm)).toHaveLength(CONTEXT_MESSAGE_LIMIT);
  });
});
