import { describe, expect, it } from "vitest";
import {
  appendToMessage,
  appendTranscriptDelta,
  ensureMessage,
  upsertMessage,
  type Message,
} from "./dialogue";

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

describe("appendTranscriptDelta", () => {
  it("replaces the placeholder with the first delta, then extends it", () => {
    const first = appendTranscriptDelta([worker, reply], "a", "We ran");
    const second = appendTranscriptDelta(first, "a", " out of milk");
    expect(second).toEqual([{ ...worker, text: "We ran out of milk" }, reply]);
  });

  it("creates a worker message for an unknown id", () => {
    expect(appendTranscriptDelta([], "a", "No milk")).toEqual([
      { ...worker, text: "No milk" },
    ]);
  });
});

describe("ensureMessage", () => {
  it("adds a new message", () => {
    expect(ensureMessage([reply], worker)).toEqual([reply, worker]);
  });

  it("keeps text that already arrived", () => {
    const streamed = { ...worker, text: "We ran" };
    expect(ensureMessage([streamed], worker)).toEqual([streamed]);
  });
});
