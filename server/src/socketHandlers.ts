import type { Server, Socket } from "socket.io";
import {
  ChatSchema,
  CollectClueSchema,
  CompleteTaskSchema,
  Events,
  JoinSchema,
  MoveSchema,
  SetReadySchema,
  VoteSchema,
} from "@moon/shared";
import type { GameManager } from "./GameManager.js";
import { RateLimiter } from "./rateLimit.js";

const moveLimiter = new RateLimiter(15, 1000); // ~ throttled client sends
const actionLimiter = new RateLimiter(10, 5000);

function sendState(io: Server, game: GameManager) {
  for (const [socketId] of game.players) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) socket.emit(Events.State, game.stateFor(socketId));
  }
}

export function attachSockets(io: Server, game: GameManager) {
  game.onBroadcastState(() => sendState(io, game));

  io.on("connection", (socket: Socket) => {
    let joined = false;
    // Track last accepted move time per socket for throttle
    let lastMove = 0;

    socket.on(Events.Join, (raw) => {
      try {
        if (!actionLimiter.check(`join-${socket.id}`)) {
          socket.emit(Events.Error, { message: "Slow down a little." });
          return;
        }
        const parsed = JoinSchema.safeParse(raw);
        if (!parsed.success) {
          socket.emit(Events.Error, {
            message: parsed.error.issues[0]?.message ?? "Invalid name or avatar.",
          });
          return;
        }
        const { player, nameAdjusted } = game.join(
          socket.id,
          parsed.data.name,
          parsed.data.avatar as never,
          parsed.data.targetPlayers,
        );
        joined = true;
        socket.emit(Events.Joined, {
          playerId: player.socketId,
          name: player.name,
          nameAdjusted,
        });
        sendState(io, game);
      } catch (err) {
        socket.emit(Events.Error, {
          message: err instanceof Error ? err.message : "Could not join.",
        });
      }
    });

    socket.on(Events.Move, (raw) => {
      if (!joined) return;
      const now = Date.now();
      if (now - lastMove < 50) return; // server-side throttle guard
      if (!moveLimiter.check(`move-${socket.id}`)) return;
      const parsed = MoveSchema.safeParse(raw);
      if (!parsed.success) return;
      lastMove = now;
      const ok = game.move(socket.id, parsed.data.x, parsed.data.y);
      if (ok) {
        // Lightweight fan-out: positions only, at most ~20Hz per client.
        // Full state (phases, journals) goes through the State event.
        socket.broadcast.emit(Events.Players, {
          players: [...game.players.values()].map((p) => ({
            id: p.socketId,
            name: p.name,
            avatar: p.avatar,
            x: Math.round(p.x),
            y: Math.round(p.y),
            connected: p.connected,
            ready: p.ready,
            cluesFound: p.cluesFound,
            tasksDone: p.tasksDone,
          })),
        });
      }
    });

    socket.on(Events.SetReady, (raw) => {
      const parsed = SetReadySchema.safeParse(raw);
      if (!parsed.success || !joined) return;
      game.setReady(socket.id, parsed.data.ready);
    });

    socket.on(Events.StartRound, () => {
      if (!joined) return;
      const gate = game.canStartAs(socket.id);
      if (!gate.ok) {
        socket.emit(Events.Error, { message: gate.reason });
        return;
      }
      if (!actionLimiter.check(`start-${socket.id}`)) return;
      const res = game.startRound();
      if (!res.ok) socket.emit(Events.Error, { message: res.reason });
    });

    socket.on(Events.CollectClue, (raw) => {
      if (!joined) return;
      if (!actionLimiter.check(`clue-${socket.id}`)) return;
      const parsed = CollectClueSchema.safeParse(raw);
      if (!parsed.success) return;
      const res = game.collectClue(socket.id, parsed.data.clueId);
      if (!res.ok) socket.emit(Events.Error, { message: res.reason });
      else {
        const me = game.getPlayer(socket.id);
        socket.emit(Events.ClueFound, {
          clueId: parsed.data.clueId,
          journal: game.stateFor(socket.id).myClues,
          finder: me?.name,
        });
      }
    });

    socket.on(Events.CompleteTask, (raw) => {
      if (!joined) return;
      if (!actionLimiter.check(`task-${socket.id}`)) return;
      const parsed = CompleteTaskSchema.safeParse(raw);
      if (!parsed.success) return;
      const res = game.completeTask(socket.id, parsed.data.taskId);
      if (!res.ok) socket.emit(Events.Error, { message: res.reason });
      else socket.emit(Events.TaskDone, { taskId: parsed.data.taskId });
    });

    socket.on(Events.SendMessage, (raw) => {
      if (!joined) return;
      if (!actionLimiter.check(`chat-${socket.id}`)) {
        socket.emit(Events.Error, { message: "Chatting too fast — breathe in the night air." });
        return;
      }
      const parsed = ChatSchema.safeParse(raw);
      if (!parsed.success) return;
      const msg = game.addMessage(socket.id, parsed.data.text);
      if (msg) io.emit(Events.Chat, msg);
    });

    socket.on(Events.Vote, (raw) => {
      if (!joined) return;
      const parsed = VoteSchema.safeParse(raw);
      if (!parsed.success) return;
      const res = game.castVote(socket.id, parsed.data.targetId);
      if (!res.ok) socket.emit(Events.Error, { message: res.reason });
      else {
        io.emit(Events.Votes, {
          votes: game.stateFor(socket.id).votes,
        });
        sendState(io, game);
      }
    });

    socket.on(Events.PlayAgain, () => {
      if (!joined) return;
      if (game.hostId !== socket.id) {
        socket.emit(Events.Error, { message: "Only the room host can start another night." });
        return;
      }
      const res = game.playAgain();
      if (!res.ok) {
        // Fall back: if round can't restart (e.g. players left), go lobby
        socket.emit(Events.Error, { message: res.reason });
      }
    });

    socket.on(Events.BackToLobby, () => {
      if (!joined) return;
      game.backToLobby();
    });

    socket.on("disconnect", () => {
      game.leave(socket.id);
    });
  });

  // Periodic sweep for stale entries (safety net; leave() is immediate).
  setInterval(() => game.markStale(), 15_000).unref?.();
}
