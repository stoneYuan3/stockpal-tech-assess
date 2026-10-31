"use client";

import { useEffect, useRef } from "react";
import { buildExportText, exportFileName } from "@/lib/exportText";
import { shareOrDownload } from "@/lib/shareOrDownload";
import { useRealtimeSession } from "@/lib/useRealtimeSession";

const BUTTON_LABEL = {
  idle: "Start conversation",
  connecting: "Connecting…",
  live: "End conversation",
};

export default function Home() {
  const { status, messages, reported, toggle, clear } = useRealtimeSession();
  const dialogueEnd = useRef<HTMLDivElement>(null);
  const empty = messages.length === 0 && reported.length === 0;

  const exportDialogue = () => {
    const now = new Date();
    void shareOrDownload(
      buildExportText(messages, reported, now),
      exportFileName(now),
    );
  };

  useEffect(() => {
    dialogueEnd.current?.scrollIntoView({ block: "end" });
  }, [messages, reported]);

  return (
    <main className="app">
      <div className="scroll">
        {reported.length > 0 && (
          <section className="report" aria-live="polite">
            <h2>Got it. The Following Ingredient is out:</h2>
            <ul>
              {reported.map((ingredient) => (
                <li key={ingredient}>{ingredient}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="dialogue" aria-label="Dialogue" aria-live="polite">
          {messages.map(({ id, role, text }) => (
            <p key={id} className={`message ${role}`}>
              {text}
            </p>
          ))}
          <div ref={dialogueEnd} />
        </section>
      </div>

      <footer className="controls">
        <button
          type="button"
          className="secondary clear"
          onClick={clear}
          disabled={status !== "idle" || empty}
        >
          Clear
        </button>
        <button
          type="button"
          className="secondary export"
          onClick={exportDialogue}
          disabled={empty}
        >
          Export
        </button>
        <button
          type="button"
          className={status === "idle" ? "toggle" : "toggle active"}
          onClick={toggle}
        >
          {BUTTON_LABEL[status]}
        </button>
      </footer>
    </main>
  );
}
