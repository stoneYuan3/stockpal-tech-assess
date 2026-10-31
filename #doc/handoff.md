# Handoff: 86ing Pal prototype

State as of 2026-10-31. Read this first, then `#doc/plan.md` (design and decisions) and `plan.pdf` (original spec and test sets).

## Current state

The prototype is built and committed, but it has never connected to OpenAI or heard real speech. The next step is a first live session with a real API key.

| Area | Status |
| --- | --- |
| App code | Complete against the plan |
| Unit tests, lint, production build | Passing |
| Browser test with a fake WebRTC layer | Passing (see Verification) |
| Phone and tablet layout | Checked in Chrome emulation only, not on real devices |
| Live OpenAI session | Not tested, no key was available |
| Spoken test Sets 1-3 | Not run, these need a person and real devices |

## Set up on a new machine

Requires Node 20.9 or later. This work used Node 24 on Windows.

1. Get the repo. It has no remote, so it must be copied or pushed somewhere first. Copy the whole folder without `node_modules` and `.next`, or use `git bundle create 86ing.bundle --all` and `git clone 86ing.bundle`.
2. Check out the working branch: `git switch feat/realtime-prototype`.
3. Run `npm install`.
4. Run `cp .env.local.example .env.local` and set `OPENAI_API_KEY`. The key is deliberately not in git, so a copied repo won't have it. The user should add it themselves, not paste it into chat.
5. Run `npm test`, `npm run lint` and `npm run build` to confirm the baseline.

## Git

- `main` holds one commit: the spec, the plan and `.gitignore`.
- `feat/realtime-prototype` holds all the other work and is not merged. Merge only when the user asks.
- Commit messages use conventional prefixes (`feat:`, `docs:`, `chore:`).
- The user asked for a good git record, so keep commits small and logical.

## Where things are

| Path | What it does |
| --- | --- |
| `lib/sessionConfig.ts` | Model, prompt, tool schema and voice detection. Most tuning happens here. |
| `lib/useRealtimeSession.ts` | WebRTC lifecycle, server event handling, idle timer, cleanup. |
| `app/api/session/route.ts` | Mints the ephemeral key. The API key stays on the server. |
| `lib/report.ts`, `lib/dialogue.ts` | Pure logic for the report list and dialogue ordering, with Vitest tests. |
| `lib/context.ts` | Builds the context message carried into each new conversation, with Vitest tests. |
| `lib/exportText.ts`, `lib/shareOrDownload.ts` | Export text and file name (with Vitest tests), and the share sheet on touch devices or a download on a PC. |
| `lib/ingredients.ts` | The 19 ingredient names. |
| `app/page.tsx`, `app/globals.css` | The single screen. |
| `#doc/e2e-fake-realtime.mjs` | The browser test described under Verification. |

## Next steps, in order

1. **First live session.** Run `npm run dev`, open http://localhost:3000 and tap Start. An invalid session field shows up as an error message in the dialogue, passed through from `client_secrets`.
2. **Check the event names against real traffic.** In `npm run dev`, every data channel event is logged to the browser console as `[realtime] <type>` (debug level, so enable Verbose). Check:
   - `conversation.item.input_audio_transcription.completed` (`item_id`, `transcript`), `.delta` (`item_id`, `delta`, streams the worker's text in) and `.failed`. The [transcription guide](https://developers.openai.com/api/docs/guides/realtime-transcription) confirms all three names. If the worker's text stays as "…", check the console first.
   - `response.output_text.delta`, which the docs also list.
   - `input_audio_buffer.committed` and its `item_id`, which the transcription guide confirms.
3. **Test on real phones and tablets.** They need HTTPS, and the README covers both LAN and Vercel routes.
4. **Support the user through Sets 1-3 in `plan.pdf`.** Tune `lib/sessionConfig.ts` from the results.

## Known risks

- **Rapid-fire reports (Set 2) are the main risk.** Whether a new turn overlaps cleanly with a response in progress is unconfirmed. If reports are dropped, set `create_response: false` and have the client queue `response.create` itself.
- **The 5-second idle limit may be tight.** A worker has about 5 seconds to answer a clarifying question.
- **`near_field` noise reduction is untested for the walk-away scenarios in Set 3.** `far_field` is the alternative.
- **`/api/session` has no auth.** Keep any deployed URL private and take it down after testing.
- **The on-screen worker text comes from a separate transcription model** (`gpt-4o-mini-transcribe`). In live testing it drifted into Japanese or Korean script and garbled English ("I don't have any how" for "we don't have honey left"), while the Realtime model still reported Honey correctly. The fix: `TRANSCRIPTION_PROMPT` in `lib/sessionConfig.ts` steers it toward English and the ingredient names, and carried-over context labels worker lines as possibly inaccurate. If the drift continues, try `gpt-4o-mini-transcribe-2025-12-15`. `gpt-transcribe` and `gpt-live-transcribe` are not supported on `v1/realtime`, and `gpt-4o-transcribe` is deprecated.

## Decisions to preserve

- **Records carry over between conversations as context.** When the data channel opens, earlier records go in as one `system` message item: the report plus the last 20 dialogue lines, without `response.create`. The prompt says never to report from it alone. Clear works only between conversations, so the screen and the model's context stay in step. That `role: "system"` items are accepted mid-session is untested live.
- **The prompt doesn't name test inputs such as "Caocao".** This keeps Set 2 a test of the model, not of a memorised answer. Don't add them unless the user asks.
- **Blue Curaçao is Syrup and the brand is Goofu.** The spec is inconsistent (Powder, Goofo). `#doc/plan.md` gives the reasoning.
- **Reports go through a tool with an `enum` of ingredient names, and the app renders the HTML.** This fixes the format and stops invented ingredients.
- **Replies are text only, and no `response.create` follows a tool call.** Both save tokens.
- **`semantic_vad` at `low` eagerness** allows mid-sentence pauses, with a maximum wait of 8 seconds.
- **Instructions live in code,** not in a dashboard-stored `session.prompt`.

## Verification

`#doc/e2e-fake-realtime.mjs` drives headless Chrome over the DevTools protocol. It replays Realtime events through a fake `RTCPeerConnection`, so it needs no key or mic.

To run it:

1. Run `npm run build`, then `npm run start -- -p 3123`. Leave `OPENAI_API_KEY` unset, because the first check expects the missing-key error.
2. Run `node "#doc/e2e-fake-realtime.mjs" <screenshot-folder>`.

It has a hardcoded Windows Chrome path, so change that on another machine. It checks the fake's event names, not OpenAI's, so a pass says nothing about whether those names are correct.

## API facts already checked

- `gpt-realtime-2.1-mini` exists and supports WebRTC and function calling. [Model page](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini).
- Session fields used in the config match the [client secrets reference](https://developers.openai.com/api/reference/cli/resources/realtime/subresources/client_secrets/index.md).
- The ephemeral key is in the response's top-level `value` field.
- The `developers.openai.com` docs are the current location. `platform.openai.com/docs` redirects there.
