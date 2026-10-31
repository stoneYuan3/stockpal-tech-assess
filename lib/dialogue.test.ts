import { describe, expect, it } from "vitest";
import { appendToMessage, upsertMessage, type Message } from "./dialogue";

const worker: Message = { id: "a", role: "worker", text: "…" };
const reply: Message = { id: "b", role: "assistant", text: "Which milk?" };

describe("upsertMessage", () => {
  it("adds a new message at the end", () => {
    expect(upsertMessage([worker], reply)).toEqual([worker, reply]);
  });

  it("fills a late transcript in its original position", () => {
    const filled = { ...worker, text: "We ran out of milk" };
    expect(upsertMessage([worker, reply], filled)).toEqual([filled, reply]);
  });
});

describe("appendToMessage", () => {
  it("starts a message from the first delta and extends it", () => {
    const first = appendToMessage([], "b", "assistant", "Which");
    const second = appendToMessage(first, "b", "assistant", " milk?");
    expect(second).toEqual([reply]);
  });
});
