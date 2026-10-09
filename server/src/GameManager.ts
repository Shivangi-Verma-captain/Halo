import {
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  PHASE_DURATIONS,
  WORLD,
  generateRound,
  normalizeName,
  pickCulprit,
  resolveNameCollision,
  type AvatarId,
  type ChatMessage,
  type ClientWorldState,
  type ClueInfo,
  type Phase,
  type PlayerPublic,
  type RoundResult,
  type TaskInfo,
} from "@moon/shared";

export interface ServerPlayer extends PlayerPublic {
  socketId: string;
  lastSeen: number;
  voteFor: string | null;
}

interface GameEvents {
  broadcastState(): void;
}

let messageSeq = 0;

export class GameManager {
  players = new Map<string, ServerPlayer>(); // socketId -> player
  /** persistent name reservations: lowercase name -> socketId (cleared on disconnect) */
  phase: Phase = "lobby";
  phaseEndsAt: number | null = null;
  round = 0;
  seed = 0;
  scenarioKey = "";
  culpritId: string | null = null;
  clues: ClueInfo[] = [];
  tasks: TaskInfo[] = [];
  cluesTaken = new Map<string, string>(); // clueId -> finder socketId
  messages: ChatMessage[] = [];
  result: RoundResult | null = null;
  private timer: NodeJS.Timeout | null = null;
  private onBroadcast: () => void = () => {};
  private fixedSeed: number | null;

  constructor(fixedSeed: number | null = null) {
    this.fixedSeed = fixedSeed;
  }

  onBroadcastState(cb: () => void) {
    this.onBroadcast = cb;
  }

  private emit() {
    this.onBroadcast();
  }

  // -- helpers -------------------------------------------------------------
  takenNames(exceptId?: string): Set<string> {
    const s = new Set<string>();
    for (const p of this.players.values()) {
      if (p.socketId !== exceptId) s.add(p.name.toLowerCase());
    }
    return s;
  }

  getPlayer(socketId: string): ServerPlayer | undefined {
    return this.players.get(socketId);
  }

  playerCount(): number {
    return this.players.size;
  }

  spawnPoint(index: number): { x: number; y: number } {
    const spots = [
      { x: 800, y: 480 },
      { x: 720, y: 480 },
      { x: 880, y: 480 },
      { x: 640, y: 560 },
      { x: 960, y: 560 },
      { x: 560, y: 640 },
      { x: 1040, y: 640 },
      { x: 800, y: 760 },
    ];
    return spots[index % spots.length];
  }

  // -- joins / leaves -------------------------------------------------------
  join(
    socketId: string,
    desiredName: string,
    avatar: AvatarId,
  ): { player: ServerPlayer; nameAdjusted: boolean } {
    if (this.players.has(socketId)) {
      const existing = this.players.get(socketId)!;
      existing.lastSeen = Date.now();
      return { player: existing, nameAdjusted: false };
    }
    if (this.players.size >= MAX_PLAYERS) {
      throw new Error("Village is full (8/8). Please try again in a moment.");
    }
    const name = resolveNameCollision(
      normalizeName(desiredName),
      this.takenNames(),
    );
    const spawn = this.spawnPoint(this.players.size);
    const player: ServerPlayer = {
      id: socketId,
      socketId,
      name,
      avatar,
      x: spawn.x,
      y: spawn.y,
      connected: true,
      ready: false,
      cluesFound: [],
      tasksDone: [],
      lastSeen: Date.now(),
      voteFor: null,
    };
    this.players.set(socketId, player);
    this.emit();
    return { player, nameAdjusted: name !== normalizeName(desiredName) };
  }

  /** Reconnect: a returning socket claims its old slot by name. If the name
   *  is still reserved by a stale (disconnected) entry, transfer it. */
  reconnect(oldSocketId: string, newSocketId: string): ServerPlayer | null {
    const old = this.players.get(oldSocketId);
    if (!old) return null;
    this.players.delete(oldSocketId);
    old.id = newSocketId;
    old.socketId = newSocketId;
    old.connected = true;
    old.lastSeen = Date.now();
    this.players.set(newSocketId, old);
    if (this.culpritId === oldSocketId) this.culpritId = newSocketId;
    // remap cluesTaken / votes referencing old id
    for (const [k, v] of this.cluesTaken) {
      if (v === oldSocketId) this.cluesTaken.set(k, newSocketId);
    }
    for (const p of this.players.values()) {
      if (p.voteFor === oldSocketId) p.voteFor = newSocketId;
    }
    this.emit();
    return old;
  }

  leave(socketId: string) {
    const p = this.players.get(socketId);
    if (!p) return;
    // Immediate removal — no ghost players. (Brief: disconnected player
    // must not remain permanently stuck.) Played clues/votes stay for
    // round integrity, but the seat frees up.
    this.players.delete(socketId);
    // If lobby empties entirely, reset to fresh lobby state.
    if (this.players.size === 0) {
      this.resetToLobby();
    }
    this.emit();
  }

  markStale(timeoutMs = 30_000) {
    const now = Date.now();
    let changed = false;
    for (const [id, p] of this.players) {
      if (!p.connected && now - p.lastSeen > timeoutMs) {
        this.players.delete(id);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  // -- movement ---------------------------------------------------------------
  move(socketId: string, x: number, y: number): boolean {
    const p = this.players.get(socketId);
    if (!p) return false;
    // Clamp to world bounds
    const b = WORLD.bounds;
    x = Math.min(Math.max(x, b.x), b.x + b.w);
    y = Math.min(Math.max(y, b.y), b.y + b.h);
    // Reject teleports (> 400px in one update — impossible at our speeds)
    const dx = x - p.x;
    const dy = y - p.y;
    if (Math.hypot(dx, dy) > 400) return false;
    p.x = x;
    p.y = y;
    p.lastSeen = Date.now();
    return true;
  }

  setReady(socketId: string, ready: boolean) {
    const p = this.players.get(socketId);
    if (!p || this.phase !== "lobby") return;
    p.ready = ready;
    this.emit();
  }

  readyCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (p.ready) n++;
    return n;
  }

  canStart(): { ok: boolean; reason?: string } {
    if (this.phase !== "lobby") return { ok: false, reason: "Round already in progress." };
    if (this.players.size < MIN_PLAYERS_TO_START)
      return { ok: false, reason: `Need at least ${MIN_PLAYERS_TO_START} villagers to begin.` };
    return { ok: true };
  }

  // -- round lifecycle --------------------------------------------------------
  startRound(): { ok: boolean; reason?: string } {
    const gate = this.canStart();
    if (!gate.ok) return gate;
    this.round += 1;
    this.seed =
      this.fixedSeed ?? Math.floor(Math.random() * 2 ** 31);
    const { scenario, clues, tasks } = generateRound(this.seed);
    this.scenarioKey = scenario.key;
    this.clues = clues;
    this.tasks = tasks;
    this.cluesTaken.clear();
    this.messages = [];
    this.result = null;
    for (const p of this.players.values()) {
      p.cluesFound = [];
      p.tasksDone = [];
      p.voteFor = null;
      p.ready = false;
    }
    const ids = [...this.players.keys()];
    this.culpritId = pickCulprit(this.seed, ids);
    this.setPhase("exploration");
    return { ok: true };
  }

  setPhase(phase: Phase) {
    this.phase = phase;
    const dur = PHASE_DURATIONS[phase];
    this.phaseEndsAt = dur > 0 ? Date.now() + dur : null;
    this.scheduleTimer();
    this.emit();
  }

  private scheduleTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.phaseEndsAt == null) return;
    const ms = Math.max(0, this.phaseEndsAt - Date.now());
    this.timer = setTimeout(() => this.advancePhase(), ms);
    this.timer.unref?.();
  }

  /** Called by timer or when all votes are in. */
  advancePhase() {
    if (this.phase === "exploration") this.setPhase("discussion");
    else if (this.phase === "discussion") this.setPhase("voting");
    else if (this.phase === "voting") this.finishRound();
    else if (this.phase === "results") this.resetToLobby();
  }

  private finishRound() {
    this.computeResult();
    this.setPhase("results");
  }

  computeResult(): RoundResult | null {
    if (!this.culpritId) return null;
    const votes: Record<string, string> = {};
    for (const p of this.players.values()) {
      if (p.voteFor) votes[p.socketId] = p.voteFor;
    }
    const tally = new Map<string, number>();
    for (const target of Object.values(votes)) {
      tally.set(target, (tally.get(target) ?? 0) + 1);
    }
    let topId: string | null = null;
    let topVotes = 0;
    let tied = false;
    for (const [id, n] of tally) {
      if (n > topVotes) {
        topVotes = n;
        topId = id;
        tied = false;
      } else if (n === topVotes) {
        tied = true;
      }
    }
    const caught = !tied && topId === this.culpritId;
    const culprit = this.players.get(this.culpritId);
    const { scenario } = generateRound(this.seed);
    const caughtBy = [...this.players.values()]
      .filter((p) => p.voteFor === this.culpritId)
      .map((p) => p.socketId);
    this.result = {
      culpritPlayerId: this.culpritId,
      culpritName: culprit?.name ?? "???",
      scenarioTitle: scenario.title,
      solutionText: scenario.solutionText,
      motive: scenario.motive,
      reasoning: scenario.reasoning,
      votes,
      caughtBy,
      villagersWin: caught,
    };
    return this.result;
  }

  playAgain(): { ok: boolean; reason?: string } {
    if (this.phase !== "results") return { ok: false, reason: "Finish the round first." };
    return this.startRound();
  }

  backToLobby() {
    this.resetToLobby();
  }

  private resetToLobby() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.phase = "lobby";
    this.phaseEndsAt = null;
    this.culpritId = null;
    this.cluesTaken.clear();
    this.messages = [];
    this.result = null;
    this.clues = [];
    this.tasks = [];
    for (const p of this.players.values()) {
      p.ready = false;
      p.voteFor = null;
      p.cluesFound = [];
      p.tasksDone = [];
    }
    this.emit();
  }

  // -- clues & tasks (server-validated) ---------------------------------------
  collectClue(socketId: string, clueId: string): { ok: boolean; reason?: string } {
    const p = this.players.get(socketId);
    if (!p) return { ok: false, reason: "Unknown player." };
    if (this.phase !== "exploration")
      return { ok: false, reason: "Clues can only be gathered during exploration." };
    const clue = this.clues.find((c) => c.id === clueId);
    if (!clue) return { ok: false, reason: "No such clue." };
    if (this.cluesTaken.has(clueId))
      return { ok: false, reason: "That clue was already found." };
    if (p.cluesFound.includes(clueId))
      return { ok: false, reason: "You already recorded that clue." };
    // Distance check — no collecting across the map.
    const d = Math.hypot(p.x - clue.x, p.y - clue.y);
    if (d > WORLD.interactRadius + 30)
      return { ok: false, reason: "Too far away — walk closer to investigate." };
    this.cluesTaken.set(clueId, socketId);
    p.cluesFound.push(clueId);
    this.emit();
    return { ok: true };
  }

  completeTask(socketId: string, taskId: string): { ok: boolean; reason?: string } {
    const p = this.players.get(socketId);
    if (!p) return { ok: false, reason: "Unknown player." };
    if (this.phase !== "exploration")
      return { ok: false, reason: "Tasks can only be done during exploration." };
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, reason: "No such task." };
    if (p.tasksDone.includes(taskId))
      return { ok: false, reason: "You already finished that task." };
    const d = Math.hypot(p.x - task.x, p.y - task.y);
    if (d > WORLD.interactRadius + 30)
      return { ok: false, reason: "Too far away — walk closer to help." };
    p.tasksDone.push(taskId);
    this.emit();
    return { ok: true };
  }

  // -- chat & voting ------------------------------------------------------------
  addMessage(socketId: string, text: string): ChatMessage | null {
    const p = this.players.get(socketId);
    if (!p) return null;
    if (this.phase !== "discussion" && this.phase !== "voting" && this.phase !== "exploration")
      return null;
    const clean = text.trim().slice(0, 200);
    if (!clean) return null;
    const msg: ChatMessage = {
      id: `m${++messageSeq}-${Date.now()}`,
      playerId: socketId,
      name: p.name,
      text: clean,
      at: Date.now(),
    };
    this.messages.push(msg);
    if (this.messages.length > 100) this.messages.splice(0, this.messages.length - 100);
    this.emit();
    return msg;
  }

  castVote(socketId: string, targetId: string): { ok: boolean; reason?: string } {
    const p = this.players.get(socketId);
    if (!p) return { ok: false, reason: "Unknown player." };
    if (this.phase !== "voting") return { ok: false, reason: "Voting is not open." };
    if (!this.players.has(targetId)) return { ok: false, reason: "That villager is gone." };
    if (targetId === socketId) return { ok: false, reason: "You cannot vote for yourself." };
    if (p.voteFor) return { ok: false, reason: "You already voted." };
    p.voteFor = targetId;
    // Early finish when everyone voted
    const voted = [...this.players.values()].filter((q) => q.voteFor).length;
    if (voted >= this.players.size) {
      this.finishRound();
    } else {
      this.emit();
    }
    return { ok: true };
  }

  // -- per-client projection (never leaks the culprit) ---------------------------
  stateFor(socketId: string): ClientWorldState {
    const me = this.players.get(socketId);
    const players: PlayerPublic[] = [...this.players.values()].map((p) => ({
      id: p.socketId,
      name: p.name,
      avatar: p.avatar,
      x: Math.round(p.x),
      y: Math.round(p.y),
      connected: p.connected,
      ready: p.ready,
      cluesFound: [...p.cluesFound],
      tasksDone: [...p.tasksDone],
    }));
    const myClues = me
      ? this.clues.filter((c) => me.cluesFound.includes(c.id))
      : [];
    const myTasks = me ? [...me.tasksDone] : [];
    const votes: Record<string, string> = {};
    if (this.phase === "voting" || this.phase === "results") {
      for (const p of this.players.values()) {
        if (p.voteFor) votes[p.socketId] = p.voteFor;
      }
    }
    return {
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      players,
      cluesTaken: Object.fromEntries(this.cluesTaken),
      myClues,
      myTasks,
      tasks: this.phase === "lobby" || this.phase === "results" ? [] : this.tasks,
      clues:
        this.phase === "lobby" || this.phase === "results"
          ? []
          : this.clues.map((c) => ({ ...c, journalText: "", pointsTo: undefined })),
      round: this.round,
      scenarioTitle: this.phase === "results" ? this.result?.scenarioTitle ?? null : null,
      youAreCulprit: this.culpritId === socketId,
      messages:
        this.phase === "discussion" || this.phase === "voting" || this.phase === "results"
          ? [...this.messages]
          : [],
      votes,
      result: this.phase === "results" ? this.result : null,
      serverTime: Date.now(),
    };
  }
}
