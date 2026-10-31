import { NextResponse } from "next/server";
import { SESSION_CONFIG } from "@/lib/sessionConfig";

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set on the server." },
      { status: 500 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session: SESSION_CONFIG }),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach OpenAI." },
      { status: 502 },
    );
  }

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok || typeof data?.value !== "string") {
    return NextResponse.json(
      { error: data?.error?.message ?? "OpenAI rejected the session request." },
      { status: 502 },
    );
  }

  return NextResponse.json({ value: data.value });
}
