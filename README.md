# Quiz Night

A multiplayer trivia night for friends, with seven familiar game-show-inspired modes, quick play, leagues, parties, and live leaderboards.

## Play modes

| Mode | How a round works |
| --- | --- |
| Pub Quiz | 12 mixed-category multiple-choice questions. |
| Millionaire | 15 questions, a 50:50 lifeline, and safe checkpoints at questions 5 and 10. |
| 1% Club | 10 logic and common-sense puzzles that increase in difficulty. |
| Jeopardy | 15 clues with point values; respond in question form. |
| The Chase | Build a cash pot, choose a safe, standard, or bold offer, then race the Chaser. |
| Lingo | Guess a five-letter word using colour feedback, in up to five tries. |
| Wheel of Fortune | Reveal a phrase by calling consonants, buying vowels, and solving it. |

The rules are implemented as original, lightweight party-game adaptations inspired by familiar TV formats. For reference, see [ITV's Lingo overview](https://www.itv.com/presscentre/press-releases/lingo), the [Jeopardy! contestant rules](https://www.jeopardy.com/jbuzz/behind-scenes/5-jeopardy-rules-every-contestant-should-know), [Wheel of Fortune's FAQ](https://wheeloffortune.com/more/faq), ABC's [Millionaire play-along and lifelines](https://abc.com/news/02390536-26c0-4630-a6c3-28f857ec6fc9/category/2737718), ITV's [The Chase overview](https://www.itv.com/presscentre/media-releases/chase-great-start-us), and ITV's [1% Club programme information](https://www.itv.com/presscentre/programme-information/full?page=10).

## Features

- Sign up with a username and password.
- Create a league or join one with its six-character invite code. League pages show wins by mode and an overall leaderboard.
- Create or join a live league party. League members can join an open party; the host picks the mode and starts once everyone is ready.
- Quick Play supports hosted six-digit rooms, joining by code, and solo games.
- Live rooms use Socket.IO. Accounts, league memberships, and wins persist in PostgreSQL when `DATABASE_URL` is configured.
- Questions are generated in batches through Google's Gemini API when `GEMINI_API_KEY` is configured. A built-in question bank keeps games playable when no key is set or generation fails. The default model is `gemini-3.8-flash`; review the [Gemini API pricing and data terms](https://ai.google.dev/gemini-api/docs/pricing) before using it.

## Run locally

Requires Node.js 20.19 or newer and npm.

```sh
npm install
cp .env.example .env
npm run dev
```

The Vite client runs at `http://localhost:5173` and proxies API and Socket.IO requests to the Express server. Set `GEMINI_API_KEY` in `.env` to enable AI-generated question batches. Set `DATABASE_URL` to a PostgreSQL connection string for persistent local data; without it the server uses in-memory storage. Set `JWT_SECRET` to a private random value for persistent local sessions.

## Deploy to Render

This repository includes a Render Blueprint in [`render.yaml`](render.yaml). In Render, create a **New Blueprint Instance**, connect this GitHub repository, and apply the Blueprint. It provisions a Node web service and PostgreSQL database, configures a generated `JWT_SECRET`, and uses `/healthz` as its health check. Add `GEMINI_API_KEY` under the web service's environment settings to enable AI generation; keep API keys out of source control.

The Blueprint uses Render's free web-service and PostgreSQL plans. Free web services can sleep after 15 minutes without traffic, and free PostgreSQL databases expire after 30 days. Review Render's current [free instance limits](https://render.com/docs/free) before relying on the service for long-term league history. Render's [Blueprint documentation](https://render.com/docs/blueprint-spec) describes the deploy flow and configuration.

## Scripts

```sh
npm run dev       # Run client and server with hot reload
npm run build     # Type-check and build the client
npm start         # Start the production server
```
