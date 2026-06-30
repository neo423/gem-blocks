import { describe, expect, test } from "vitest";
import { removalFxPlan } from "./fx";

describe("match-3 effect planning", () => {
  test("scales removal effects with cleared gems and combo depth", () => {
    const normal = removalFxPlan(3, 1);
    const combo = removalFxPlan(8, 3);

    expect(combo.shardsPerGem).toBeGreaterThan(normal.shardsPerGem);
    expect(combo.dustPerGem).toBeGreaterThan(normal.dustPerGem);
    expect(combo.ringRadius).toBeGreaterThan(normal.ringRadius);
    expect(combo.chimeNotes.length).toBeGreaterThan(normal.chimeNotes.length);
  });

  test("keeps large cascades inside readable visual limits", () => {
    const plan = removalFxPlan(64, 8);

    expect(plan.shardsPerGem).toBeLessThanOrEqual(14);
    expect(plan.dustPerGem).toBeLessThanOrEqual(8);
    expect(plan.cameraShakeIntensity).toBeLessThanOrEqual(0.007);
    expect(plan.durationMs).toBeLessThanOrEqual(560);
  });
});
