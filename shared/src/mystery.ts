import { CLUE_SPAWNS, TASK_SPAWNS, type AvatarId } from "./constants.js";
import type { ClueInfo, MysteryScenario, TaskInfo } from "./types.js";

// ---------------------------------------------------------------------------
// Curated clue + task library. Every clue has fixed world placement and a
// journal entry. Scenarios reference clue ids; generation only picks WHICH
// scenario + WHO the culprit is, so rounds can never contradict themselves.
// ---------------------------------------------------------------------------

const CLUE_LIBRARY: Record<
  string,
  { name: string; description: string; location: string; journalText: string; pointsTo?: string }
> = {
  footprint: {
    name: "Unusual Footprint",
    description: "A boot-print by the fountain, dusted with pale moon-dust.",
    location: "Village Fountain",
    journalText:
      "A single boot-print near the fountain glitters with pale moon-dust. Someone stood here long after bedtime.",
    pointsTo: "Whoever took the moon walked through its dust.",
  },
  "torn-letter": {
    name: "Torn Letter",
    description: "Half a letter in the library, arguing about 'borrowing the night'.",
    location: "Tiny Library",
    journalText:
      "Torn letter: '...you cannot simply BORROW the night, the village needs its sleep...' Signed with a single initial.",
    pointsTo: "The culprit told someone their plan — and was refused.",
  },
  "pocket-watch": {
    name: "Stopped Pocket Watch",
    description: "A pocket watch frozen at midnight, found by the clock tower.",
    location: "Clock Tower",
    journalText:
      "A silver pocket watch stopped at exactly midnight. The glass smells faintly of lantern oil.",
    pointsTo: "The moon vanished at midnight — and oil was involved.",
  },
  "violet-fabric": {
    name: "Scrap of Violet Fabric",
    description: "Violet cloth snagged on a rose thorn in the garden.",
    location: "Overgrown Garden",
    journalText:
      "A scrap of violet fabric caught on the garden thorns. Fine weave — not a farmer's cloth.",
    pointsTo: "The culprit tore their cloak sneaking through the garden.",
  },
  "star-chart": {
    name: "Marked Star Chart",
    description: "An observatory chart with the moon circled, again and again.",
    location: "Observatory",
    journalText:
      "A star chart with the moon circled in ink, over and over. Someone has been studying it for weeks.",
    pointsTo: "This was planned — not a prank.",
  },
  "lantern-oil": {
    name: "Empty Lantern-Oil Can",
    description: "An oil can behind the cottages, wiped clean — almost.",
    location: "Cottages",
    journalText:
      "An empty lantern-oil can, wiped clean except for one thumbprint in soot. Someone needed a LOT of light.",
    pointsTo: "The clocktower lamp burned all night to hide the dark.",
  },
  "muddy-boot": {
    name: "Muddy Boot",
    description: "One muddy boot abandoned near the square, laces knotted twice.",
    location: "Village Square",
    journalText:
      "A muddy boot with laces knotted twice. The mud matches the garden path, not the square.",
    pointsTo: "The culprit crossed the garden in a hurry.",
  },
  "moon-crumb": {
    name: "Crumb of Moonlight",
    description: "A crumb that glows faintly, dropped near the fountain path.",
    location: "Village Square",
    journalText:
      "A crumb of something that glows faintly blue. It hums when you hold it. Part of the moon — dropped on the way out.",
    pointsTo: "The moon was carried away on foot, toward the observatory hill.",
  },
};

const TASK_LIBRARY: Record<
  string,
  { name: string; description: string; location: string; rewardText: string }
> = {
  "task-fountain": {
    name: "Clear the Fountain",
    description: "Scoop fallen leaves from the fountain.",
    location: "Village Fountain",
    rewardText: "The water settles — and something glints at the bottom.",
  },
  "task-garden": {
    name: "Tidy the Garden",
    description: "Pull weeds from the moonflower bed.",
    location: "Overgrown Garden",
    rewardText: "Under the weeds: a dropped button of violet cloth.",
  },
  "task-observatory": {
    name: "Realign the Telescope",
    description: "Crank the observatory mechanism back into place.",
    location: "Observatory",
    rewardText: "Through the lens: scratch marks on the moon-dais. It was lifted, not vanished.",
  },
  "task-library": {
    name: "Reshelve Books",
    description: "Put the scattered books back.",
    location: "Tiny Library",
    rewardText: "Behind the atlas: a parcel stub addressed to the observatory hill.",
  },
  "task-clocktower": {
    name: "Wind the Clock",
    description: "Wind the sleepy clock tower mechanism.",
    location: "Clock Tower",
    rewardText: "The gears turn — and a sooty rag drops out of the lamp housing.",
  },
};

// Mulberry32 — tiny deterministic PRNG so a seed fully defines a round.
export function rngFromSeed(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export const SCENARIOS: MysteryScenario[] = [
  {
    key: "lantern-keeper",
    title: "The Lantern Keeper's Night",
    solutionText:
      "The culprit dimmed the clocktower lamp with lantern oil, climbed the observatory hill, and winched the moon down with the old star-chart crane — to read by its light, forever.",
    motive: "They wanted one endless night to finish their book of constellations.",
    culpritAvatar: "owl",
    clueIds: ["pocket-watch", "lantern-oil", "star-chart", "footprint", "torn-letter", "moon-crumb"],
    taskIds: ["task-clocktower", "task-observatory", "task-library"],
    reasoning: [
      "The stopped watch fixes the moment: midnight.",
      "The oil can explains the too-bright clocktower lamp that hid the dark.",
      "The marked star chart shows weeks of planning at the observatory.",
    ],
  },
  {
    key: "garden-mischief",
    title: "The Garden Mischief",
    solutionText:
      "Stung by a refusal in the torn letter, the culprit dragged the moon down through the garden to prove the night could be 'replanted' — tearing their violet cloak on the thorns.",
    motive: "A prank to prove moonflowers would bloom brighter under a stolen moon.",
    culpritAvatar: "frog",
    clueIds: ["violet-fabric", "muddy-boot", "torn-letter", "footprint", "moon-crumb", "star-chart"],
    taskIds: ["task-garden", "task-fountain", "task-observatory"],
    reasoning: [
      "Violet fabric + garden mud place the culprit in the garden that night.",
      "The torn letter shows the motive: a refused dare.",
      "Moon-crumbs trail from the fountain toward the observatory hill.",
    ],
  },
  {
    key: "square-confession",
    title: "The Square Confession",
    solutionText:
      "The culprit lured the moon low over the square with the fountain's old wishing bell, then bottled pieces of moonlight — dropping crumbs all the way home.",
    motive: "They missed the moon's hum and wanted to keep a piece singing by their bed.",
    culpritAvatar: "hare",
    clueIds: ["moon-crumb", "footprint", "muddy-boot", "pocket-watch", "violet-fabric", "lantern-oil"],
    taskIds: ["task-fountain", "task-clocktower", "task-garden"],
    reasoning: [
      "Moon-crumbs cluster around the fountain: the moon came LOW here.",
      "The footprint's moon-dust proves someone stood beneath it.",
      "Oil + midnight watch explain how the dark was hidden.",
    ],
  },
];

export interface GeneratedRound {
  seed: number;
  scenario: MysteryScenario;
  clues: ClueInfo[];
  tasks: TaskInfo[];
}

export function listScenarios(): MysteryScenario[] {
  return SCENARIOS;
}

export function getScenario(key: string): MysteryScenario {
  const s = SCENARIOS.find((s) => s.key === key);
  if (!s) throw new Error(`Unknown scenario: ${key}`);
  return s;
}

/** Deterministically build a round's clue/task set from a seed.
 *  The scenario is chosen by seed; clue positions come from CLUE_SPAWNS.
 *  Never contradictory: clues always belong to the chosen scenario. */
export function generateRound(seed: number): GeneratedRound {
  const rng = rngFromSeed(seed);
  const scenario = pick(rng, SCENARIOS);
  const clues: ClueInfo[] = scenario.clueIds.map((id) => {
    const lib = CLUE_LIBRARY[id];
    const spawn = CLUE_SPAWNS.find((s) => s.id === id);
    if (!lib || !spawn) throw new Error(`Missing clue definition: ${id}`);
    return { id, x: spawn.x, y: spawn.y, ...lib };
  });
  const tasks: TaskInfo[] = scenario.taskIds.map((id) => {
    const lib = TASK_LIBRARY[id];
    const spawn = TASK_SPAWNS.find((s) => s.id === id);
    if (!lib || !spawn) throw new Error(`Missing task definition: ${id}`);
    return { id, x: spawn.x, y: spawn.y, ...lib };
  });
  return { seed, scenario, clues, tasks };
}

/** Pick the culprit fairly from connected players using round seed. */
export function pickCulprit(seed: number, playerIds: string[]): string {
  if (playerIds.length === 0) throw new Error("No players to choose culprit from");
  const rng = rngFromSeed(seed ^ 0x9e3779b9);
  return pick(rng, [...playerIds].sort());
}

export function getClueLibrary(): typeof CLUE_LIBRARY {
  return CLUE_LIBRARY;
}
