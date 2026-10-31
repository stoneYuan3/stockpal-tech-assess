# 86ing Pal: Realtime API tech assessment plan

2026-10-30

## Context

This prototype tests whether OpenAI's Realtime API, using [gpt-realtime-2.1-mini](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini), can take spoken "we're out of X" reports from restaurant workers in chaotic conditions.

It covers only the receiving side: it hears a report, works out which ingredients are out and prints them. It does not update any ordering platform. The project folder contains only `plan.pdf`, so this is a new build, and no code has been written yet.

## Stack and architecture

The build uses Next.js (latest, App Router, TypeScript), because the app needs a small server route to keep the API key out of the browser. Vite would need a separate backend.

The browser gets a short-lived key from the app's server, then connects directly to OpenAI. The API key stays on the server, and audio goes straight to OpenAI. The flow follows OpenAI's [WebRTC guide](https://developers.openai.com/api/docs/guides/realtime-webrtc).

1. Tapping Start makes the browser call `POST /api/session` on the Next.js server.
2. The server calls OpenAI `POST /v1/realtime/client_secrets` with the session config and gets a short-lived `ek_…` key.
3. The server returns the key to the browser.
4. The browser opens the mic, creates an `RTCPeerConnection` and a `oai-events` data channel, then POSTs its SDP offer to `https://api.openai.com/v1/realtime/calls` with the key.
5. Mic audio and events flow directly between the browser and OpenAI over WebRTC.

## Files

The app is one screen, one server route and a small `lib` folder.

| File | Purpose |
| --- | --- |
| `app/page.tsx`, `app/layout.tsx`, `app/globals.css` | One screen: dialogue, report and a large thumb-reachable Start/End button. Mobile-first, no UI library. |
| `app/api/session/route.ts` | Creates the client secret. Reads `OPENAI_API_KEY` from the server environment only. |
| `lib/ingredients.ts` | The 19 ingredient names, the single source of truth. |
| `lib/sessionConfig.ts` | Model, instructions, tool schema, VAD settings. |
| `lib/useRealtimeSession.ts` | React hook: WebRTC lifecycle, event handling, idle timer, cleanup. |
| `lib/report.ts` + test | Pure logic for merging reported ingredients (ordering, dedupe). Vitest. |
| `.env.local.example`, `.gitignore`, `README.md` | Key setup, run instructions, phone testing steps. |

## Session behaviour

The model decides what is out, and the app controls what appears on screen. This keeps the report format fixed and limits token use.

**Prompt delivery.** Instructions live in `session.instructions` in code, so they are versioned and easy to tune between test runs. A dashboard-stored `session.prompt` would need setup outside the repo and gives no behavioural benefit here.

**Reporting uses a tool, not free text.** The tool is `report_unavailable_ingredients({ ingredients: [...] })`, with an `enum` of the 19 exact names.

- The app renders the required HTML itself, so the format cannot drift and the model cannot invent an ingredient.
- The list accumulates across the session in reported order, with duplicates removed. The rapid-fire 3-report and 5-report tests need this.
- The list stays visible after the session ends and clears on the next Start.
- After a tool call, the app sends `function_call_output` but no `response.create`, so no tokens are spent on a confirmation.

```html
<h2>Got it. The Following Ingredient is out:</h2>
<ul><li>…</li></ul>
```

**Replies are text only** (`output_modalities: ["text"]`). Audio output costs [$20 per 1M tokens against $2.40 for text](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini), and the spec asks for on-screen text. Clarifying questions appear on screen and are not spoken. The worker's speech appears in the dialogue through input transcription.

**Instructions cover every test scenario:**

| Input | Behaviour |
| --- | --- |
| Exact or partial name with one clear match | Report it ("Blue Curaçao" or "Curaçao" → Blue Curaçao Syrup) |
| Unclear or sound-alike name | Never assume, ask ("Caocao" → Cocoa powder or Blue Curaçao Syrup?) |
| Ambiguous category | Ask ("Milk" → Coconut, Fresh or Oat Milk?) |
| Several ingredients in one or more statements | Report all of them |
| Cut-off sentence with no ingredient | Say the message was cut off and do nothing |
| Partly heard or fading speech | Report if confident, otherwise ask for confirmation |
| Background voice during a report | Report only the main speaker's ingredient. If unclear, ask, and never report the background one |
| Anything else | One fixed polite line saying it only handles ingredient reports, with no conversation |

Fictional brands (Spide, Goofu, Wonpao) get likely phonetic variants so they are matched despite odd transcription.

**Turn detection and audio:**

- [`semantic_vad`](https://developers.openai.com/api/docs/guides/realtime-vad) with `eagerness: "low"`, so a 1-2 second pause mid-sentence ("We ran out of… Ribena") is not split into two turns.
- `interrupt_response: false`, so a quick second report does not cancel the tool call for the first.
- `noise_reduction: { type: "near_field" }`.
- Mic constraints: echo cancellation, noise suppression and auto gain on.
- Reasoning effort low, and a cap on output tokens.

**Idle shutdown.** A 5-second timer starts when the session connects and restarts after each response finishes. It is paused while the user is speaking (`input_audio_buffer.speech_started` to `speech_stopped`) or a response is in progress.

When it fires, the app closes the connection, stops the mic tracks and shows "Session ended (idle)". Pressing End does the same cleanup. A worker has about 5 seconds to answer a clarifying question.

## Decisions on spec inconsistencies

The spec conflicts with itself in two places, so the build uses the spelling that appears most often.

| Topic | Decision | Reason |
| --- | --- | --- |
| Blue Curaçao Syrup vs Powder | Syrup | The ingredient list and Set 1 say Syrup; only Set 2's desired outcome says Powder. Set 2 passes if it reports Blue Curaçao Syrup. |
| Goofu vs Goofo | Goofu | Used in both the ingredient list and Set 1. "Goofo" is treated as a phonetic variant. |
| "Caocao" | Mispronunciation | Input is spoken, so it can't be a misspelling. |
| Language | English only | Cantonese input is not in the test sets. |

## Implementation order

The build runs from pure logic outward, so the riskiest part, the live session, is tested last on a checked base.

1. Scaffold Next.js, add `.gitignore` and `.env.local.example`.
2. Write `ingredients`, `sessionConfig` and `report` with unit tests.
3. Write `/api/session`.
4. Write the hook and the UI.
5. Check the exact fields against the API reference: reasoning effort path, output token cap and the transcription model. A 400 from `client_secrets` will show any wrong field immediately.
6. Run the verification below.

## Verification

Claude can check that the app builds and connects, but you need to run the spoken test scenarios on real devices.

- `npm run build`, lint and Vitest pass.
- Without a key, `/api/session` returns a clear error and the UI shows it.
- With your API key, Claude confirms a real session connects and the session config is accepted. Put the key in `.env.local` yourself rather than pasting it into chat.
- The mobile layout is checked at phone and tablet widths.
- You run the spoken scenarios (Sets 1-3). Claude can't speak into a phone, walk it away from a sound source or create ambient noise, and these results are the point of the assessment.

## Known limitations

Rapid-fire reports are the main technical risk, and phone testing needs HTTPS.

- **Rapid-fire reports.** Whether a new turn overlaps cleanly with an in-flight response can only be confirmed live. If reports are dropped in Set 2, set `create_response: false` and have the client queue `response.create` itself.
- **Phones need HTTPS.** Browsers block mic access on non-localhost HTTP. Use `next dev --experimental-https` on the LAN, which requires accepting the self-signed certificate warning and adding the LAN IP to `allowedDevOrigins`. Alternatively deploy to Vercel. The README will cover both.
- **`/api/session` has no auth.** Anyone with a deployed URL could start sessions on your OpenAI account. This is acceptable on a LAN. Keep any deployed URL private and take it down after testing.
- **The on-screen transcript can differ from what the Realtime model heard.** It comes from a separate transcription model, so a mismatch doesn't by itself mean the model misheard.
