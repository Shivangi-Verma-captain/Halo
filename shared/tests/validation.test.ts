import { describe, expect, it } from "vitest";
import { normalizeName, resolveNameCollision } from "../src/validation";
import { JoinSchema, MoveSchema } from "../src/validation";

describe("validation", () => {
  it("accepts good names and rejects bad ones", () => {
    expect(JoinSchema.safeParse({ name: "Wren", avatar: "moth" }).success).toBe(true);
    expect(JoinSchema.safeParse({ name: "X", avatar: "moth" }).success).toBe(false);
    expect(JoinSchema.safeParse({ name: "A".repeat(17), avatar: "moth" }).success).toBe(false);
    expect(JoinSchema.safeParse({ name: "<script>", avatar: "moth" }).success).toBe(false);
    expect(JoinSchema.safeParse({ name: "Wren", avatar: "dragon" }).success).toBe(false);
  });

  it("rejects out-of-bounds moves", () => {
    expect(MoveSchema.safeParse({ x: 100, y: 100 }).success).toBe(true);
    expect(MoveSchema.safeParse({ x: -5, y: 100 }).success).toBe(false);
    expect(MoveSchema.safeParse({ x: 9999, y: 100 }).success).toBe(false);
    expect(MoveSchema.safeParse({ x: NaN, y: 100 }).success).toBe(false);
  });

  it("resolves name collisions safely", () => {
    expect(normalizeName("  Wren   Moon  ")).toBe("Wren Moon");
    const taken = new Set(["wren"]);
    expect(resolveNameCollision("Wren", taken)).toBe("Wren 2");
    const taken2 = new Set(["wren", "wren 2"]);
    expect(resolveNameCollision("Wren", taken2)).toBe("Wren 3");
  });
});
