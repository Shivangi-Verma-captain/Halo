# Implementation Plan & Milestone Checklist

## Architecture
```
Halo/
├── shared/   types, events, constants, zod validation, mystery generation
├── server/   authoritative GameManager + Socket.IO handlers + rate limits
├── client/   React UI + Phaser 3 village + WebAudio sfx
├── docs/     game brief, art direction, asset manifest, deployment
└── e2e/      Playwright multiplayer verification (in client/)
```

- **Authoritative server:** all joins, moves (clamped, teleport-rejected),
  clue/task collection (phase + proximity validated), chat, votes, phase
  transitions, and results computed server-side. Clients never decide outcomes.
- **Networking:** Socket.IO with websocket+pillback, reconnection, per-client
  `stateFor()` projection (culprit never leaks), lightweight `players` fan-out
  for movement (~throttled), full `state` sync on changes.
- **Deterministic mystery:** seeded PRNG picks 1 of 3 curated scenarios; clues
  always belong to the scenario — no contradictory rounds. `pickCulprit` is
  seed + roster based.

## Milestones
- [x] **A — Setup & skeleton:** npm workspaces, TS configs, shared/server/client scaffolds.
- [x] **B — Multiplayer village:** join with name+avatar, 8 slots, duplicate-name
  resolution, leave without ghosts, movement sync, connection indicator.
- [x] **C — Movement/collision/interaction:** WASD+arrows, SOLIDS collision,
  camera follow, smooth remote lerp, clue/task markers + E-prompt.
- [x] **D — Mystery state machine:** lobby→exploration→discussion→voting→results,
  ready/start, server timers, journal, tasks, chat, votes, reveal, replay.
- [x] **E — Art consistency:** procedural storybook village, 8 avatars, palette,
  Fraunces+Karla type, docs + manifest.
- [x] **F — Responsive/polish/a11y:** drawer UI, kbd shortcuts, focus states,
  reduced-motion, mute, mobile grids.
- [x] **G — Testing/deployment:** run `npm test`, run Playwright e2e with two
  real browsers, deploy frontend + persistent backend (see DEPLOYMENT.md).

## Acceptance (Milestone B/G) — verify by running, not by reading
1. `npm.cmd run dev:server` starts backend on :3001 (`/health` ok).
2. `npm.cmd run dev:client` starts frontend on :5173.
3. Two independent browsers join → each sees the other's avatar + name.
4. Movement in one appears in the other (smooth, not teleporting).
5. Eight real clients can occupy all slots; 9th is refused with a message.
6. Closing a tab removes that villager for everyone (no ghosts).
7. Server restart / offline backend shows understandable feedback on landing.
8. No critical console errors.
