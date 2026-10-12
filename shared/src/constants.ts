// Shared constants — single source of truth for client + server.
export const MAX_PLAYERS = 8;
export const MIN_PLAYERS_TO_START = 5;

export const WORLD = {
  width: 1600,
  height: 1200,
  playerSpeed: 220, // px/sec
  interactRadius: 90,
  moveThrottleMs: 80,
  // Walkable bounds inset (world border walls)
  bounds: { x: 40, y: 40, w: 1520, h: 1120 },
} as const;

export const AVATARS = [
  { id: "moth", name: "Moth Keeper", coat: "#8f7bd8", trim: "#f2c572" },
  { id: "fox", name: "Fox Friend", coat: "#d9764f", trim: "#f7ead7" },
  { id: "owl", name: "Owl Scholar", coat: "#5b8c8a", trim: "#f2c572" },
  { id: "cat", name: "Alley Cat", coat: "#4a4a68", trim: "#e88ca0" },
  { id: "frog", name: "Pond Frog", coat: "#6fa287", trim: "#f7ead7" },
  { id: "hare", name: "Moon Hare", coat: "#b9a8d9", trim: "#4a4a68" },
  { id: "badger", name: "Honey Badger", coat: "#8a6f5c", trim: "#f2c572" },
  { id: "wren", name: "Night Wren", coat: "#3f6d8e", trim: "#e88ca0" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export const PHASES = [
  "lobby",
  "exploration",
  "discussion",
  "voting",
  "results",
] as const;
export type Phase = (typeof PHASES)[number];

// Phase durations (ms). Server is authoritative; client only displays countdowns.
export const PHASE_DURATIONS: Record<Phase, number> = {
  lobby: 0, // open-ended until host/auto start conditions met
  exploration: 4 * 60 * 1000,
  discussion: 2 * 60 * 1000,
  voting: 60 * 1000,
  results: 45 * 1000,
};

// Collision rectangles (x, y, w, h) in world coords — buildings/props.
// Kept in shared so server distance/line-of-sight checks and client
// Phaser static bodies agree exactly.
export interface SolidRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const SOLIDS: SolidRect[] = [
  // Central fountain
  { id: "fountain", x: 740, y: 540, w: 120, h: 120 },
  // Cottages
  { id: "cottage-west", x: 150, y: 220, w: 220, h: 170 },
  { id: "cottage-east", x: 1230, y: 220, w: 220, h: 170 },
  { id: "library", x: 150, y: 800, w: 260, h: 180 },
  { id: "clocktower", x: 700, y: 120, w: 200, h: 160 },
  { id: "observatory", x: 1180, y: 800, w: 280, h: 200 },
  // Forest Path shrine and trees (shared with Phaser collision boundaries).
  { id: "forest-tree-west", x: 1270, y: 520, w: 56, h: 72 },
  { id: "forest-shrine", x: 1380, y: 620, w: 76, h: 104 },
  { id: "forest-tree-east", x: 1490, y: 580, w: 58, h: 76 },
  { id: "forest-tree-south", x: 1280, y: 720, w: 64, h: 80 },
  // Garden beds (low, but solid for simplicity)
  { id: "garden-bed-1", x: 480, y: 850, w: 160, h: 90 },
  { id: "garden-bed-2", x: 660, y: 850, w: 160, h: 90 },
];

export interface ClueSpawn {
  id: string;
  x: number;
  y: number;
}

export const CLUE_SPAWNS: ClueSpawn[] = [
  { id: "footprint", x: 740, y: 700 },
  { id: "torn-letter", x: 300, y: 760 },
  { id: "pocket-watch", x: 800, y: 330 },
  { id: "violet-fabric", x: 560, y: 830 },
  { id: "star-chart", x: 1300, y: 770 },
  { id: "lantern-oil", x: 1250, y: 450 },
  { id: "muddy-boot", x: 420, y: 420 },
  { id: "moon-crumb", x: 900, y: 620 },
];

export const TASK_SPAWNS: ClueSpawn[] = [
  { id: "task-fountain", x: 670, y: 600 },
  { id: "task-garden", x: 740, y: 920 },
  { id: "task-observatory", x: 1240, y: 980 },
  { id: "task-library", x: 240, y: 1000 },
  { id: "task-clocktower", x: 640, y: 300 },
];
