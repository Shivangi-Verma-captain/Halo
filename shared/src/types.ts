import type { AvatarId, Phase } from "./constants.js";

export interface PlayerPublic {
  id: string; // socket id (server-assigned)
  name: string;
  avatar: AvatarId;
  x: number;
  y: number;
  connected: boolean;
  /** The first connected player in the room may start a classic round. */
  isHost?: boolean;
  /** true when the player pressed Ready (lobby) */
  ready: boolean;
  /** clues this player has personally discovered (ids) */
  cluesFound: string[];
  /** tasks this player completed (ids) */
  tasksDone: string[];
}

export interface ClueInfo {
  id: string;
  name: string;
  description: string;
  /** world position */
  x: number;
  y: number;
  /** which location label to show */
  location: string;
  /** flavor shown in journal after discovery */
  journalText: string;
  /** id of the scenario-specific "pointsTo" hint, if any */
  pointsTo?: string;
}

export interface TaskInfo {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  location: string;
  rewardText: string;
}

export interface MysteryScenario {
  /** deterministic scenario key, e.g. "lantern-keeper" */
  key: string;
  title: string;
  /** narrative shown on results screen */
  solutionText: string;
  motive: string;
  /** which avatar archetype name is guilty in this scenario seed mapping */
  culpritAvatar: AvatarId;
  /** ordered clue ids that solve this mystery (subset of CLUE_SPAWNS) */
  clueIds: string[];
  /** task ids available this round */
  taskIds: string[];
  /** short "how to solve it" shown post-reveal */
  reasoning: string[];
}

export interface RoundConfig {
  seed: number;
  scenarioKey: string;
  culpritPlayerId: string;
  /** round number (increments each replay) */
  round: number;
}

/** What the server sends to a client — NEVER includes culprit identity
 *  except to the culprit themselves via `youAreCulprit`. */
export interface ClientWorldState {
  phase: Phase;
  targetPlayers: number;
  phaseEndsAt: number | null; // epoch ms, null for open-ended lobby
  players: PlayerPublic[];
  /** clues already taken globally (id -> playerId who found it first).
   *  NOTE: clues are shared-world pickups in this ruleset: first finder
   *  reveals it; everyone sees it as "found". Personal journals track
   *  which clues each player has seen. */
  cluesTaken: Record<string, string>;
  /** per-player journal is derived from server events; full state sync
   *  includes the requesting player's own journal only. */
  myClues: ClueInfo[];
  myTasks: string[];
  tasks: TaskInfo[];
  clues: ClueInfo[]; // clue metadata WITHOUT solution linkage
  round: number;
  scenarioTitle: string | null; // revealed only at results; null before
  youAreCulprit: boolean;
  /** discussion messages (latest N) */
  messages: ChatMessage[];
  /** votes so far in voting phase: voterId -> targetId (counts only, no names leaked beyond players list) */
  votes: Record<string, string>;
  /** results payload, present only in results phase */
  result: RoundResult | null;
  serverTime: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
}

export interface RoundResult {
  culpritPlayerId: string;
  culpritName: string;
  scenarioTitle: string;
  solutionText: string;
  motive: string;
  reasoning: string[];
  votes: Record<string, string>;
  /** playerIds that voted for the culprit */
  caughtBy: string[];
  villagersWin: boolean;
}

export type Role = "culprit" | "villager";
