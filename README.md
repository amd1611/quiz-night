# Quiz Night

Multiplayer trivia: Lingo, Jeopardy, Wheel of Fortune, Millionaire, The Chase, 1% Club, Pub Quiz and Guess the Song.
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

## Customise
- Rules, timings, ladders, wheel segments: `shared/src/config.ts`
- Questions, songs, words, phrases: `shared/src/content.ts`
