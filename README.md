# Who Stole the Moon?

A cozy fantasy **multiplayer social mystery** for up to 8 real villagers in one
shared storybook village. The moon has vanished — explore, gather clues, lend a
paw with small tasks, discuss, vote, and unmask the culprit.

Built with React + TypeScript + Vite, Phaser 3, Node.js + Socket.IO (authoritative
server), Zod validation, Vitest, and Playwright.

## Quick start (local)

Prerequisites: **Node 20+** and npm.

```bash
npm install
npm run build -w @moon/shared   # shared types must build first
npm run dev:server              # backend → http://localhost:3001 (/health)
npm run dev:client              # frontend → http://localhost:5173
```

Open `http://localhost:5173` in **two browsers**, pick different names, and you
will see each other's villagers. Move with `WASD` / arrow keys.

| Command | What it does |
|---|---|
| `npm run dev:server` | Start backend with hot reload (`server/`, port `PORT` or 3001) |
| `npm run dev:client` | Start frontend dev server (`client/`, port 5173) |
| `npm run build` | Build shared → server → client |
| `npm run test` | Unit/integration tests (shared + server) |
| `npm run test:e2e -w @moon/client` | Two-browser multiplayer test (needs both dev servers running) |

## How a round works

1. **Lobby** — join with a name + avatar (duplicates become `Name 2`, …). Press
   **Ready**; anyone can press **Begin the Night** once ≥3 villagers gather.
2. **Exploration (4 min)** — walk to golden glimmers to investigate clues and
   green glimmers to help with tasks. Press `E` or the on-screen prompt.
3. **Discussion (2 min)** — compare notes in Talk (`C`).
4. **Voting (60 s)** — one vote each, no self-votes (`Vote` panel opens automatically).
5. **Results** — culprit reveal, motive, and the reasoning trail. **New Mystery**
   or **Back to Village Square**.

Panel shortcuts: `J` journal · `T` tasks · `C` talk · `V` villagers.

## Project layout

```
shared/  constants, types, socket events, zod schemas, deterministic mystery gen
server/  authoritative GameManager, Socket.IO handlers, rate limits (src/)
client/  React UI (src/components), Phaser village (src/game), sounds (sound.ts)
docs/    game brief, art direction, asset manifest, deployment, plan
scripts/ verify-live.mjs — two-client live check (dev only)
```

The server is authoritative: it validates names, clamps movement, rejects
teleports, enforces clue/task proximity + phase rules, counts votes, and never
sends the culprit's identity to other clients.

## Deploying

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). You need **two** hosts: a static
host for `client/dist/` (with `VITE_SERVER_URL` baked in) and a persistent
Node process for `server/` (with `CLIENT_URL` set for CORS). Verify with
`GET /health`.

## Docs

- `docs/IMPLEMENTATION-PLAN.md` — architecture + milestone checklist
- `docs/art-direction/GAME-BRIEF.md`, `ART-DIRECTION.md`, `ASSET-MANIFEST.md`, `REFERENCES.md`
- `docs/DEPLOYMENT.md` — env vars, build/start commands, post-deploy checks

## Limitations (honest)

- Client bundle is ~1.7 MB (Phaser) — fine on broadband, heavy on slow links.
  Code-splitting the game canvas is the next perf win.
- Rounds need ≥3 villagers; a solo explorer can wander but not start a mystery.
- Sounds are synthesized WebAudio (no recorded ambience yet).
- Reference images were absent from the repo, so all art is original procedural
  work — see `docs/art-direction/REFERENCES.md`.
