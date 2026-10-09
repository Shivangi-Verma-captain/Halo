# Deployment

The game has **two** deployables. Static hosting alone is NOT enough — the
Socket.IO server must run as a persistent process.

## Environment variables

### Server (`server/`)
| Var | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | no | `3001` | HTTP + Socket.IO listen port |
| `CLIENT_URL` | **yes (prod)** | `http://localhost:5173` | CORS origin for the frontend |
| `ADDITIONAL_ORIGINS` | no | — | Comma-separated extra CORS origins |
| `FIXED_SEED` | no | — | Pin a mystery seed for debugging |

### Client (`client/`, build-time)
| Var | Required | Purpose |
|---|---|---|
| `VITE_SERVER_URL` | **yes (prod)** | Backend URL the browser connects to, e.g. `https://moon-server.example.com` |

Never hardcode `localhost` for production. Never put secrets in `VITE_*` vars
(they ship in the browser bundle).

## Local development
```bash
npm install
npm run dev:server   # :3001 — http://localhost:3001/health
npm run dev:client   # :5173 — proxies /socket.io + /health to :3001
```

## Production build
```bash
npm run build
npm --prefix server start     # serves Socket.IO + /health (needs CLIENT_URL set)
# serve client/dist/ from any static host (Netlify, Vercel, Pages, S3…)
# with VITE_SERVER_URL=https://<your-server> baked in at build time
```

Example backend hosts: Render, Railway, Fly.io, or any VM with Node 20+.
Example: `CLIENT_URL=https://moon-village.netlify.app PORT=3001 npm --prefix server start`.

## Health checks
- `GET /health` → `{ ok, game, players, phase, time }`. Use as the load-balancer
  health check and as the landing page's "server unreachable" probe.

## Verifying multiplayer after deploy
1. Open the frontend URL in **two different browsers/devices**.
2. Join with different names; confirm each sees the other's avatar + name.
3. Walk in one; confirm smooth movement in the other.
4. Collect a clue in one; confirm `cluesTaken` count changes for both.
5. Run a full round: Begin → explore → discuss → vote → results → New Mystery.
