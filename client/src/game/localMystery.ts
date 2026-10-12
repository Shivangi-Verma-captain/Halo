import { AVATARS, generateRound, type AvatarId, type ClientWorldState, type PlayerPublic, type RoundResult } from "@moon/shared";

export interface LocalHuman { name: string; avatar: AvatarId }

/** Local, deterministic rules adapter. No socket or server is created here. */
export interface LocalMystery { world: ClientWorldState; culpritId: string; scenario: ReturnType<typeof generateRound>["scenario"] }

export function startLocalMystery(humans: LocalHuman[], round: number): LocalMystery {
  if (humans.length < 1 || humans.length > 4) throw new Error("Local play supports one to four human investigators.");
  const occupied = new Set(humans.map((h) => h.avatar));
  let seed = Math.floor(Math.random() * 2 ** 31);
  let generated = generateRound(seed);
  // Preserve each authored scenario's culprit archetype. Reroll only the
  // scenario seed when the chosen suspect would collide with a human avatar.
  while (occupied.has(generated.scenario.culpritAvatar)) {
    seed = (seed + 1) >>> 0;
    generated = generateRound(seed);
  }
  const { scenario, clues, tasks } = generated;
  const humanPlayers: PlayerPublic[] = humans.map((human, i) => ({
    id: `local-human-${i}`, name: human.name, avatar: human.avatar,
    // The lead investigator begins at the fountain clue so a first-time solo run can act immediately.
    x: [740, 720, 880, 640][i], y: [700, 480, 480, 560][i],
    connected: true, ready: true, cluesFound: [], tasksDone: [],
  }));
  const cast = [...humanPlayers];
  for (const [index, avatar] of AVATARS.entries()) {
    if (cast.length >= 8) break;
    if (occupied.has(avatar.id)) continue;
    cast.push({
      id: `local-npc-${avatar.id}`, name: avatar.name, avatar: avatar.id,
      x: [1000, 1120, 520, 1080, 420, 1180, 920, 680][index],
      y: [450, 590, 650, 700, 520, 520, 1040, 700][index],
      connected: false, ready: true, cluesFound: [], tasksDone: [],
    });
  }
  const world: ClientWorldState = {
    phase: "exploration", targetPlayers: humans.length, phaseEndsAt: null, players: cast, cluesTaken: {},
    myClues: [], myTasks: [], tasks,
    clues: clues.map(({ journalText: _journalText, pointsTo: _pointsTo, ...clue }) => ({ ...clue, journalText: "", pointsTo: undefined })),
    round, scenarioTitle: null, youAreCulprit: false, messages: [], votes: {}, result: null, serverTime: Date.now(),
  };
  const culpritId = cast.find((p) => p.id === `local-npc-${scenario.culpritAvatar}`)?.id ?? cast[0].id;
  return { world, culpritId, scenario };
}

export function localResult(world: ClientWorldState, culpritId: string, targetId: string, scenario: ReturnType<typeof generateRound>["scenario"]): ClientWorldState {
  const culprit = world.players.find((p) => p.id === culpritId);
  if (!culprit) return world;
  const result: RoundResult = {
    culpritPlayerId: culprit.id, culpritName: culprit.name, scenarioTitle: scenario.title,
    solutionText: scenario.solutionText, motive: scenario.motive, reasoning: scenario.reasoning,
    votes: { [world.players[0]?.id ?? "local-human-0"]: targetId },
    caughtBy: targetId === culprit.id ? [world.players[0]?.id ?? "local-human-0"] : [],
    villagersWin: targetId === culprit.id,
  };
  return { ...world, phase: "results", phaseEndsAt: null, scenarioTitle: scenario.title, result };
}
