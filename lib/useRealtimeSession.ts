"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  appendToMessage,
  appendTranscriptDelta,
  ensureMessage,
  PENDING_TEXT,
  upsertMessage,
  type Message,
} from "./dialogue";
import type { Ingredient } from "./ingredients";
import { mergeReported, parseToolIngredients } from "./report";
import { REPORT_TOOL_NAME } from "./sessionConfig";

const IDLE_TIMEOUT_MS = 5000;

export type SessionStatus = "idle" | "connecting" | "live";

type ServerEvent = {
  type: string;
  item_id?: string;
  delta?: string;
  text?: string;
  transcript?: string;
  error?: { message?: string };
  response?: {
    status?: string;
    status_details?: { error?: { message?: string } };
    output?: {
      type: string;
      name?: string;
      call_id?: string;
      arguments?: string;
    }[];
  };
};

export function useRealtimeSession() {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [reported, setReported] = useState<Ingredient[]>([]);
  const endSession = useRef<((notice?: string) => void) | null>(null);

  const addSystemMessage = useCallback((text: string) => {
    setMessages((current) =>
      upsertMessage(current, {
        id: crypto.randomUUID(),
        role: "system",
        text,
      }),
    );
  }, []);

  const start = useCallback(async () => {
    setMessages([]);
    setReported([]);
    setStatus("connecting");

    const abort = new AbortController();
    const peer = new RTCPeerConnection();
    const channel = peer.createDataChannel("oai-events");
    const handledCalls = new Set<string>();
    let stream: MediaStream | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let speaking = false;
    let activeResponses = 0;
    let ended = false;

    const end = (notice?: string) => {
      if (ended) return;
      ended = true;
      clearTimeout(idleTimer);
      abort.abort();
      channel.close();
      peer.close();
      stream?.getTracks().forEach((track) => track.stop());
      endSession.current = null;
      setStatus("idle");
      if (notice) addSystemMessage(notice);
    };
    endSession.current = end;

    // Waits for silence: the clock must not run out mid-sentence or mid-reply.
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      if (speaking || activeResponses > 0) return;
      idleTimer = setTimeout(
        () => end("Session ended (idle)."),
        IDLE_TIMEOUT_MS,
      );
    };

    const handleToolCalls = (output: ServerEvent["response"]) => {
      for (const item of output?.output ?? []) {
        if (item.type !== "function_call" || item.name !== REPORT_TOOL_NAME) {
          continue;
        }
        if (!item.call_id || handledCalls.has(item.call_id)) continue;
        handledCalls.add(item.call_id);

        const ingredients = parseToolIngredients(item.arguments ?? "");
        setReported((current) => mergeReported(current, ingredients));

        // No response.create follows: the report on screen is the confirmation.
        if (channel.readyState === "open") {
          channel.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: item.call_id,
                output: JSON.stringify({ recorded: true }),
              },
            }),
          );
        }
      }
    };

    const handleEvent = (event: ServerEvent) => {
      switch (event.type) {
        case "input_audio_buffer.speech_started":
          speaking = true;
          resetIdleTimer();
          break;
        case "input_audio_buffer.speech_stopped":
          speaking = false;
          resetIdleTimer();
          break;
        case "input_audio_buffer.committed":
          if (event.item_id) {
            setMessages((current) =>
              ensureMessage(current, {
                id: event.item_id!,
                role: "worker",
                text: PENDING_TEXT,
              }),
            );
          }
          break;
        case "conversation.item.input_audio_transcription.delta":
          if (event.item_id && event.delta) {
            const { item_id: id, delta } = event;
            setMessages((current) => appendTranscriptDelta(current, id, delta));
          }
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (event.item_id) {
            setMessages((current) =>
              upsertMessage(current, {
                id: event.item_id!,
                role: "worker",
                text: event.transcript?.trim() || "(no speech transcribed)",
              }),
            );
          }
          break;
        case "conversation.item.input_audio_transcription.failed":
          if (event.item_id) {
            setMessages((current) =>
              upsertMessage(current, {
                id: event.item_id!,
                role: "worker",
                text: "(transcript unavailable)",
              }),
            );
          }
          break;
        case "response.created":
          activeResponses += 1;
          resetIdleTimer();
          break;
        case "response.output_text.delta":
          if (event.item_id && event.delta) {
            const { item_id: id, delta } = event;
            setMessages((current) =>
              appendToMessage(current, id, "assistant", delta),
            );
          }
          break;
        case "response.done":
          activeResponses = Math.max(0, activeResponses - 1);
          handleToolCalls(event.response);
          if (event.response?.status === "failed") {
            addSystemMessage(
              event.response.status_details?.error?.message ??
                "The model could not respond.",
            );
          }
          resetIdleTimer();
          break;
        case "error":
          addSystemMessage(event.error?.message ?? "Realtime API error.");
          break;
      }
    };

    channel.addEventListener("open", () => {
      setStatus("live");
      resetIdleTimer();
    });
    channel.addEventListener("message", ({ data }) => {
      const event = JSON.parse(data) as ServerEvent;
      // Dev only: lets the event names be checked against real traffic.
      if (process.env.NODE_ENV === "development") {
        console.debug("[realtime]", event.type, event);
      }
      handleEvent(event);
    });
    peer.addEventListener("connectionstatechange", () => {
      if (
        peer.connectionState === "failed" ||
        peer.connectionState === "disconnected"
      ) {
        end("Connection lost.");
      }
    });

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (ended) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      peer.addTrack(stream.getAudioTracks()[0], stream);

      const sessionResponse = await fetch("/api/session", {
        method: "POST",
        signal: abort.signal,
      });
      const session = await sessionResponse.json();
      if (!sessionResponse.ok) throw new Error(session.error);

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${session.value}`,
            "Content-Type": "application/sdp",
          },
          signal: abort.signal,
        },
      );
      if (!sdpResponse.ok) {
        throw new Error(`OpenAI refused the call (${sdpResponse.status}).`);
      }
      await peer.setRemoteDescription({
        type: "answer",
        sdp: await sdpResponse.text(),
      });
    } catch (error) {
      if (ended) return;
      const message =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Microphone access was blocked."
          : error instanceof Error && error.message
            ? error.message
            : "Could not start the session.";
      end(message);
    }
  }, [addSystemMessage]);

  const toggle = useCallback(() => {
    if (endSession.current) endSession.current("Session ended.");
    else void start();
  }, [start]);

  useEffect(() => () => endSession.current?.(), []);

  return { status, messages, reported, toggle };
}
