# Architecture

The visuals of the mini-games (fixed stage, art catalogue, studio) are described in [visual-architecture.md](visual-architecture.md).

```
C:\MelinaApp\
├── apps\game\            React + TypeScript + Vite + Phaser 3 (interface and game)
├── apps\server\          Node.js + TypeScript + Fastify (local API, rules, AI)
├── packages\shared\      types, contracts, texts (fr-CA / pt-BR), normalization, RNG
├── packages\curriculum\  skill catalogue, exercise generators, grading
├── packages\adaptive-engine\  deterministic adaptive engine
├── packages\handwriting\ image validation, metadata removal, sample selection
├── packages\ai\          Claude API client (handwriting reading)
├── packages\art\         game art: cards, requests, image providers, checks
├── content\              skills, texts, words, missions, scenes and art cards (JSON)
├── data\                 SQLite database, photos and backups (not versioned)
├── tests\                synthetic images and E2E test
└── docs\
```

## Running

- The server listens only on `127.0.0.1:3001` and also serves the compiled interface (`apps/game/dist`), on the same origin.
- In development (`pnpm dev`), Vite runs on `127.0.0.1:5173` and forwards `/api` to the server.
- For use, the server is bundled with esbuild into **a single file**, `apps/server/dist/server.mjs` (`pnpm build`). `iniciar.bat` runs that file with Node.js, without `node_modules` and without installing dependencies.
- In development, TypeScript runs with `tsx` and the workspace packages are imported directly from the source code.
- The database is the SQLite built into Node (`node:sqlite`), with no native dependency to compile on Windows.
- Nothing is loaded from a CDN. The Internet is only used by the optional reading with Claude.
- To package it as a desktop application in the future (Electron or Tauri), it is enough to wrap the server and the interface. The teaching packages do not depend on the presentation layer.

## Players (18/11/2026)

- Every request carries the player in the `x-melina-profile` header (`apps/game/src/player.ts`, `api.ts`). The server
  builds a per-request context (`cx(req)` in `app.ts`) and every query on a child's data uses `pid(c)`; without the
  header it is Melina's original profile (`local-profile`), so older clients and the tests keep working. An unknown
  player is refused (400): data is never written to the wrong child.
- A round or sheet of another player is «not found» (404).
- The learner model's cache is per database and per player. Player-specific settings are stored as `key#profileId`
  (Melina keeps the plain key: no migration).
- The app is mounted again for each player (`<App key={player.id} />` in `screens/Players.tsx`), so nothing of the
  previous player stays on screen. A reload of the same window keeps the player (sessionStorage); a new start shows
  the picker.

## Main flow

```
Melina                         Parents                            Server
──────                         ───────                            ──────
interacts in the world (Phaser) ─▶ React decides the action
"Commencer"                                                      POST /api/assignments
                                                                  → engine picks skill + level (with reason)
                                                                  → generator creates exercise (frozen snapshot)
reads, answers on paper
"J'ai terminé sur papier"                                        POST /assignments/:id/done
                               Espace parents → photo or manual  POST /assignments/:id/photo | /manual
                               (optional) Lire avec l’IA           POST /reviews/:id/analyze
                                                                  → Claude receives only the image and the answer TYPE
                               confirms the text + help           POST /reviews/:id/confirm
                                                                  → transaction: attempt, reading, mastery,
                                                                    mission, reward, sample
feedback + narrative progress ◀───────────────────────────────── result (expected answer only now)
```

## On-screen mini-games

- `GET /api/games` lists the games with rounds played and stars.
- `POST /api/game-rounds` starts (or resumes) a round: the adaptive engine picks the skill and level, and the server stores the snapshot with the answer.
- `POST /api/game-rounds/:id/answer` receives the answer typed by the child. **Evaluation is done on the server**; the interface does not declare a correct answer. Up to 3 attempts per round.
- In the database, the round is an `assignment` with `input_mode = 'screen'`; the evaluation is an `attempt` also marked as `screen`. The paper activities use `paper`.
- The mini-game interface is built in React/DOM with CSS and Web Animations (`apps/game/src/games/`). Phaser is still used in "Jardin de Lila".
- Sound: effects synthesized with Web Audio. Voice: the browser's speech synthesis (`apps/game/src/audio.ts`).

## Separating reading × evaluation

1. **Reading**: interprets what is written. It can be manual or done by the AI, which receives neither the expected answer nor the question.
2. **Confirmation**: the parents confirm the text. It is always mandatory in version 1.
3. **Evaluation**: `evaluate()` compares the confirmed transcription with the exercise snapshot. It runs on the server and ignores any "correct" field sent by the browser.

## States

- Exercise: `presented → answered_on_paper → in_review → confirmed`, or `illegible`, which allows a new photo or typing, or `cancelled`.
- Reading: `pending → analyzing → suggested | failed → confirmed | illegible | cancelled`.

## Integrity and idempotency

- `attempts.assignment_id` and `attempts.review_id` are UNIQUE: an exercise produces at most one evaluation.
- `mission_steps (profile, mission, step)` and `rewards (profile, key)` are primary keys, which prevents duplicate rewards.
- Confirmation runs in a `BEGIN IMMEDIATE` transaction. A repeated confirmation returns the previous result with `duplicate: true`.
- A mission step with an open exercise returns the same exercise on resume, without creating another.
- The step's seed only sprouts with a **correct** answer (with or without a hint). With a wrong answer, the step stays open and comes back with another question, chosen as reinforcement of the same skill; nothing already earned is taken away.
- **Sheet time:** the paper answer counts at the moment she FINISHED (`done_at`, migration 6), not when the parents confirmed. This applies to the «another day» rule and to the day shown in the report.
- **Wrong tries (migration 7, 18/11/2026):** `assignments.wrong_answers` keeps, in order, the wrong answers of an on-screen round before the right one (JSON list). The model still learns only from the first try; this column tells the parents WHAT she confuses (heard «three», chose «tree»; right object, wrong colour). The app's own automatic backup runs before the migration.
- **Paper routes** (done, photo, transcription, confirmation) refuse on-screen game rounds (`not-paper`). A hint opened in the app counts as help even if the parents mark «seule».
- **AI reading:** a new photo or transcription cancels the reading in progress (its result is discarded); on startup, a reading stuck in «analyzing» goes back to «failed» (`interrupted`); during the analysis, the text cannot be edited.
- **Resending the confirmation** returns the rewards that confirmation gave (if the 1st response got lost on the network, she still sees the seed).
- **Second instance:** before touching the database and the photos, the server checks the port. Game already open: it only opens the browser. Another program: message and exit. Before, it migrated the database under the 1st instance and deleted uploads in progress.
- **Transaction:** if `BEGIN` fails (database busy), the following transactions are not left switched off.
- The photo is first written to `photos/tmp` and renamed inside the transaction. On startup, orphan files go to `photos/orphans` and temporary ones are removed.

## React–Phaser integration

- `GameBridge` (`apps/game/src/game/bridge.ts`) is the contract. React sends `controls` and `view` (rewards, goal and text). Phaser emits `ready`, `interact` and `position`.
- There is a single game instance per mount, destroyed on unmount. Subscriptions are removed on SHUTDOWN and DESTROY.
- The scene keeps no progress: everything comes from the server through React.
- The controls are paused while a dialogue, an exercise or the parent area is open.

## Local API security

- The server only listens on `127.0.0.1`.
- The `Host` must be `127.0.0.1` or `localhost`, which protects against DNS rebinding.
- Mutations and photo reads require the `x-melina-client: 1` header, which forces a CORS preflight (not allowed), and a local `Origin` when present.
- The `data/` folder is not served. Photos only go through `/api/photos/:id`, with a database lookup and no user paths.
- Uploads accept up to 8 MB. The type is validated by the content and not by the extension. The internal name is a UUID, and the name sent by the browser is ignored.
- The compiled version uses a restrictive Content-Security-Policy.

## Git and secrets (18/11/2026)

- Private repository: https://github.com/RonaldDBA/MelinaApp. At each completed phase: commit and push (authorized by the parent).
- **Secrets guard** (`scripts/check-secrets.py`), switched on by the hooks in `.githooks/` (`git config core.hooksPath .githooks`; in a new clone, run this command once). It runs before each commit and each push and blocks:
  - `.env`, `ClaudeAPIKey.txt`, `data/`, databases, lock files, backup copies and loose tests in the root;
  - key formats (Anthropic, OpenAI, GitHub, Google, AWS, Slack, private key);
  - «password/api_key/token = "…"» with a value that looks real;
  - any secret value currently in `.env` or `ClaudeAPIKey.txt`. The comparison is done in memory, and the message shows only the variable's name, never the value.
- Full history scan: `python scripts/check-secrets.py --all`. Never use `git commit --no-verify`.
