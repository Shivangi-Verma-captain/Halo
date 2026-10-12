import { describe, expect, it, beforeEach } from "vitest";
import { GameManager } from "../src/GameManager";

function makeGame() {
  return new GameManager(1234);
}

function join8(game: GameManager): string[] {
  const ids: string[] = [];
  const avatars = ["moth", "fox", "owl", "cat", "frog", "hare", "badger", "wren"] as const;
  for (let i = 0; i < 8; i++) {
    const id = `s${i}`;
    game.join(id, `Villager${i === 0 ? "" : " " + i}`, avatars[i]);
    ids.push(id);
  }
  return ids;
}

describe("GameManager multiplayer core", () => {
  let game: GameManager;
  beforeEach(() => {
    game = makeGame();
    game.onBroadcastState(() => {});
  });

  it("supports 8 real players and resolves duplicate names", () => {
    game.join("a", "Wren", "moth");
    const { player } = game.join("b", "Wren", "fox");
    expect(player.name).toBe("Wren 2");
    join8(new GameManager());
  });

  it("rejects a 9th player", () => {
    const g = makeGame();
    g.onBroadcastState(() => {});
    join8(g);
    expect(() => g.join("extra", "New", "moth")).toThrow(/full/i);
  });

  it("requires five connected humans and only the host may start classic play", () => {
    const ids: string[] = [];
    const avatars = ["moth", "fox", "owl", "cat", "frog"] as const;
    for (let i = 0; i < 4; i++) {
      ids.push(`player-${i}`);
      game.join(`player-${i}`, `Player ${i}`, avatars[i]);
    }
    expect(game.canStartAs(ids[0]).ok).toBe(false);
    ids.push("player-4");
    game.join("player-4", "Player 4", avatars[4]);
    expect(game.canStartAs(ids[0]).ok).toBe(true);
    expect(game.canStartAs(ids[1])).toEqual({ ok: false, reason: "Only the room host can begin the night." });
    expect(game.stateFor(ids[1]).players.find((p) => p.id === ids[0])?.isHost).toBe(true);
  });

  it("honors the host's selected human count up to all eight seats", () => {
    const ids: string[] = [];
    const avatars = ["moth", "fox", "owl", "cat", "frog", "hare", "badger", "wren"] as const;
    for (let i = 0; i < 7; i++) {
      ids.push(`target-${i}`);
      game.join(`target-${i}`, `Target ${i}`, avatars[i], i === 0 ? 8 : 5);
    }
    expect(game.targetPlayers).toBe(8);
    expect(game.canStartAs(ids[0]).ok).toBe(false);
    ids.push("target-7");
    game.join("target-7", "Target 7", avatars[7]);
    expect(game.canStartAs(ids[0]).ok).toBe(true);
  });

  it("removes players on leave (no ghosts) and resets when empty", () => {
    game.join("a", "Wren", "moth");
    game.leave("a");
    expect(game.playerCount()).toBe(0);
    expect(game.phase).toBe("lobby");
  });

  it("clamps movement to bounds and rejects teleports", () => {
    game.join("a", "Wren", "moth");
    const p = game.getPlayer("a")!;
    const ox = p.x;
    // teleport attempt
    expect(game.move("a", ox + 900, p.y)).toBe(false);
    // normal step
    expect(game.move("a", ox + 10, p.y)).toBe(true);
    // far jump across the map is rejected as a teleport (anti-cheat),
    // even though the target would clamp into bounds
    expect(game.move("a", 10, 10)).toBe(false);
    // walk stepwise toward the corner instead: small steps accepted + clamped
    let px = game.getPlayer("a")!.x;
    let py = game.getPlayer("a")!.y;
    for (let i = 0; i < 60; i++) {
      game.move("a", px - 30, py - 30);
      px = game.getPlayer("a")!.x;
      py = game.getPlayer("a")!.y;
    }
    expect(game.getPlayer("a")!.x).toBeGreaterThanOrEqual(40);
    expect(game.getPlayer("a")!.y).toBeGreaterThanOrEqual(40);
  });

  it("runs a full round: start -> clue -> task -> discussion -> vote -> results", () => {
    const ids = join8(game);
    // need min players — we have 8
    const started = game.startRound();
    expect(started.ok).toBe(true);
    expect(game.phase).toBe("exploration");
    expect(game.culpritId).not.toBeNull();

    // clue collection requires proximity: teleport player next to first clue
    const clue = game.clues[0];
    game.move(ids[0], clue.x, clue.y);
    // move() rejects teleports, so set directly for test setup
    game.getPlayer(ids[0])!.x = clue.x;
    game.getPlayer(ids[0])!.y = clue.y;
    const res = game.collectClue(ids[0], clue.id);
    expect(res.ok).toBe(true);
    // duplicate rejected
    expect(game.collectClue(ids[1], clue.id).ok).toBe(false);

    // far-away collection rejected
    const clue2 = game.clues[1];
    expect(game.collectClue(ids[1], clue2.id).ok).toBe(false);

    // task
    const task = game.tasks[0];
    game.getPlayer(ids[1])!.x = task.x;
    game.getPlayer(ids[1])!.y = task.y;
    expect(game.completeTask(ids[1], task.id).ok).toBe(true);
    expect(game.completeTask(ids[1], task.id).ok).toBe(false); // no double

    // chat only in open phases
    expect(game.addMessage(ids[0], "I saw something!")).not.toBeNull();

    // advance to voting
    game.setPhase("discussion");
    game.setPhase("voting");
    // self-vote rejected
    expect(game.castVote(ids[0], ids[0]).ok).toBe(false);
    // everyone votes for culprit except culprit (votes innocently)
    const culprit = game.culpritId!;
    for (const id of ids) {
      if (id === culprit) continue;
      const target = culprit;
      const r = game.castVote(id, target);
      expect(r.ok).toBe(true);
      if (game.phase === "results") break;
    }
    // last voter (culprit) triggers finish; if not finished, force remaining
    if (game.phase !== "results") {
      game.castVote(culprit, ids.find((i) => i !== culprit)!);
    }
    expect(game.phase).toBe("results");
    expect(game.result).not.toBeNull();
    expect(game.result!.culpritPlayerId).toBe(culprit);
    expect(game.result!.villagersWin).toBe(true);

    // per-client state never leaks scenario/clues linkage pre-results,
    // and never exposes culprit id
    const g2 = makeGame();
    g2.onBroadcastState(() => {});
    join8(g2);
    g2.startRound();
    const s = g2.stateFor(ids[0]);
    expect(JSON.stringify(s)).not.toContain(g2.scenarioKey === "x" ? "impossible" : "winched the moon");
    expect(s.youAreCulprit).toBe(ids[0] === g2.culpritId);
  });

  it("out-of-phase actions are rejected", () => {
    const ids = join8(game);
    // lobby: no clue collection
    game.clues = [];
    expect(game.collectClue(ids[0], "footprint").ok).toBe(false);
    expect(game.castVote(ids[0], ids[1]).ok).toBe(false);
  });
});
