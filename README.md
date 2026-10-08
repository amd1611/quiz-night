# Quiz Night

Multiplayer trivia: Lingo, Jeopardy, Wheel of Fortune, Millionaire, The Chase, 1% Club and Pub Quiz.
React + TypeScript client, Node + Socket.IO server (authoritative: answers never reach the browser), shared rules.

```
/client   React + Vite UI (mobile-first)
/server   Node + Socket.IO (game.ts = rules/flow, store.ts = leagues file, test.ts = headless test)
/shared   config.ts (ALL rules), content.ts (questions), engine.ts (pure logic), types.ts
```

## Run it
```
npm install
npm run dev        # server on :3001, client on :5173
npm test           # plays every mode headless
```

## Play on your phone (same Wi-Fi)
`npm run dev` prints a Network URL such as `http://192.168.1.20:5173`. Open it on the phones.

## Deploy free on Render
1. Push this folder to a GitHub repo.
2. Render > New > Web Service > pick the repo (render.yaml is included).
   Build: `npm install && npm run build`, Start: `npm start`, Plan: Free.
3. Share the URL. Friends join with the 6-digit code or the invite link.

Notes: the free plan sleeps when idle (first load takes ~30s) and its disk is wiped on every redeploy/restart,
so leagues and leaderboards reset. For permanent leagues, add a Render Disk and set `DATA_DIR` to its mount path.

## Endless AI questions (free)
Without a key the game uses the built-in bank (24 questions). With a key, every game gets fresh questions
written by an AI, and the next game's questions are prepared in the background while you sit in the lobby.
If the AI is down or over its free quota, the game silently falls back to the built-in bank.

1. Get a free key at https://aistudio.google.com/apikey (Google account, no card).
2. Local: copy `.env.example` to `.env` and paste the key after `GEMINI_API_KEY=`. Restart `npm run dev`.
3. Render: your service > Environment > Add `GEMINI_API_KEY` = your key > Save (it redeploys).
4. The server log says `AI questions: ON`, and games show a 🤖 next to the mode name.

Uses about 1 request per game, well inside the free tier. Free-tier limits and model names change over time: check
AI Studio. Set `AI_MODEL` to switch models. Any OpenAI-compatible service also works (Groq etc.): see `.env.example`.
The key stays on the server and never reaches the browser. AI trivia can occasionally be wrong; the prompt asks for
well-established facts only.

## Customise
- Rules, timings, ladders, wheel segments: `shared/src/config.ts`
- Questions, words, phrases: `shared/src/content.ts`
