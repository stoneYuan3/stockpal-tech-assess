# 86ing Pal prototype

A mobile-first tech assessment of OpenAI's Realtime API (`gpt-realtime-2.1-mini`). Workers say which ingredient has run out, and the app prints a list of what is out. The spec is in `plan.pdf` and the implementation plan is in `#doc/plan.md`.

## Setup

Requires Node 20.9 or later and an OpenAI account with Realtime access.

```sh
npm install
cp .env.local.example .env.local
```

Add your key to `OPENAI_API_KEY` in `.env.local`.

## Run on this computer

```sh
npm run dev
```

Open http://localhost:3000, tap **Start conversation** and allow the microphone.

## Run on a phone or tablet

Browsers block the microphone on plain HTTP unless the address is `localhost`, so devices need HTTPS. Use one of these options.

**Same Wi-Fi (self-signed certificate)**

1. Find this computer's LAN IP, for example `192.168.1.20`.
2. Set `DEV_ORIGINS=192.168.1.20` in `.env.local`.
3. Run `npm run dev:https`.
4. On the device, open `https://192.168.1.20:3000` and accept the certificate warning.

**Vercel**

1. Deploy the project and set `OPENAI_API_KEY` in the Vercel project settings.
2. Keep the URL private. `/api/session` has no auth, so anyone with the URL can start sessions on your account.
3. Take the deployment down after testing.

## Behaviour

- Tap once to start and again to end. A session also ends after 5 seconds without speech or a reply, so a worker has about 5 seconds to answer a clarifying question.
- The report and dialogue accumulate in order and carry over to the next conversation. Each new conversation sends them to the model as context (the report plus the last 20 dialogue lines), so a question left unanswered can still be answered after a restart. Tap **Clear** between conversations, or reload the page, to start fresh.
- Replies are text only, to save tokens.
- The worker's text streams into the dialogue once their turn ends, not while they are still speaking. It comes from a separate, smaller transcription model and is often less accurate than what the Realtime model understood, so a garbled bubble can still produce the right report. It can differ from what the Realtime model heard, so check the model's behaviour rather than the transcript alone.

## Tuning

Prompt, tool and voice detection settings are in `lib/sessionConfig.ts`. The idle timeout is in `lib/useRealtimeSession.ts`.

## Checks

```sh
npm test
npm run lint
npm run build
```

## Test scenarios

The test sets are in `plan.pdf`. Spoken scenarios need a real device and a noisy room.

If rapid back-to-back reports get dropped, set `create_response: false` in `lib/sessionConfig.ts` and have the client queue `response.create` itself.
