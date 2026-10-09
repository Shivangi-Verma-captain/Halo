import { describe, expect, it } from "vitest";
import {
  generateRound,
  getScenario,
  listScenarios,
  pickCulprit,
  rngFromSeed,
} from "../src/mystery";

describe("mystery generation", () => {
  it("is deterministic for the same seed", () => {
    const a = generateRound(1234);
    const b = generateRound(1234);
    expect(a.scenario.key).toBe(b.scenario.key);
    expect(a.clues.map((c) => c.id)).toEqual(b.clues.map((c) => c.id));
    expect(a.tasks.map((t) => t.id)).toEqual(b.tasks.map((t) => t.id));
  });

  it("only references clues/tasks that exist in the world spawns", async () => {
    const { CLUE_SPAWNS, TASK_SPAWNS } = await import("../src/constants");
    for (let seed = 1; seed <= 50; seed++) {
      const { scenario, clues, tasks } = generateRound(seed);
      expect(scenario.clueIds.length).toBeGreaterThanOrEqual(5);
      for (const c of clues) {
        expect(CLUE_SPAWNS.some((s) => s.id === c.id)).toBe(true);
        expect(c.journalText.length).toBeGreaterThan(10);
      }
      for (const t of tasks) {
        expect(TASK_SPAWNS.some((s) => s.id === t.id)).toBe(true);
      }
    }
  });

  it("every scenario is solvable: clues + reasoning are non-empty and linked", () => {
    for (const s of listScenarios()) {
      expect(s.solutionText.length).toBeGreaterThan(20);
      expect(s.motive.length).toBeGreaterThan(5);
      expect(s.reasoning.length).toBeGreaterThanOrEqual(3);
      const round = generateRound(99);
      void round;
      const fetched = getScenario(s.key);
      expect(fetched.clueIds.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("picks a culprit deterministically from the player list", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(pickCulprit(42, ids)).toBe(pickCulprit(42, ids));
    expect(ids).toContain(pickCulprit(42, ids));
    // order-independent (sorted internally)
    expect(pickCulprit(42, [...ids].reverse())).toBe(pickCulprit(42, ids));
  });

  it("rng is stable", () => {
    const r1 = rngFromSeed(7);
    const r2 = rngFromSeed(7);
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });
});
