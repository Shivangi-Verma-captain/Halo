import { z } from "zod";
import { AVATARS, MAX_PLAYERS, WORLD } from "./constants.js";

const avatarIds = AVATARS.map((a) => a.id) as [string, ...string[]];

export const NameSchema = z
  .string()
  .trim()
  .min(2, "Name needs at least 2 characters")
  .max(16, "Name must be 16 characters or fewer")
  .regex(/^[A-Za-z0-9 _'-]+$/, "Only letters, numbers, spaces, _ ' -");

export const JoinSchema = z.object({
  name: NameSchema,
  avatar: z.enum(avatarIds),
});

export const MoveSchema = z.object({
  x: z.number().finite().min(0).max(WORLD.width),
  y: z.number().finite().min(0).max(WORLD.height),
});

export const SetReadySchema = z.object({
  ready: z.boolean(),
});

export const CollectClueSchema = z.object({
  clueId: z.string().min(1).max(64),
});

export const CompleteTaskSchema = z.object({
  taskId: z.string().min(1).max(64),
});

export const ChatSchema = z.object({
  text: z.string().trim().min(1).max(200),
});

export const VoteSchema = z.object({
  targetId: z.string().min(1).max(128),
});

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Resolve a display-name collision: "Wren" -> "Wren 2", "Wren 3", ... */
export function resolveNameCollision(
  desired: string,
  taken: Set<string>,
): string {
  const base = normalizeName(desired);
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; i <= MAX_PLAYERS + 10; i++) {
    const candidate = `${base} ${i}`.slice(0, 16);
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base.slice(0, 10)} ${Math.floor(Math.random() * 900 + 100)}`;
}

export type JoinInput = z.infer<typeof JoinSchema>;
export type MoveInput = z.infer<typeof MoveSchema>;
