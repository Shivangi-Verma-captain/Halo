import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { loadConfig } from "./config.js";
import { GameManager } from "./GameManager.js";
import { attachSockets } from "./socketHandlers.js";

const config = loadConfig();
const app = express();
app.use(cors({ origin: config.corsOrigins, credentials: true }));
const game = new GameManager(config.fixedSeed);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    game: "who-stole-the-moon",
    players: game.playerCount(),
    phase: game.phase,
    time: Date.now(),
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Small helper used by /health (kept on the class would be cleaner, but
// avoids touching GameManager for ops-only needs).

attachSockets(io, game);

httpServer.listen(config.port, () => {
  console.log(`[moon-server] listening on :${config.port}`);
  console.log(`[moon-server] CORS origins: ${config.corsOrigins.join(", ")}`);
});
