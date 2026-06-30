import { describe, expect, test } from "vitest";
import { musicStepForBeat } from "./audio";

describe("gem audio sequencing", () => {
  test("cycles background music through a stable gem-like motif", () => {
    const first = musicStepForBeat(0);
    const repeated = musicStepForBeat(8);

    expect(repeated.frequency).toBe(first.frequency);
    expect(first.duration).toBeGreaterThan(musicStepForBeat(1).duration);
  });

  test("keeps music tones in a soft high-register range", () => {
    const frequencies = Array.from({ length: 8 }, (_, beat) => musicStepForBeat(beat).frequency);

    expect(Math.min(...frequencies)).toBeGreaterThanOrEqual(392);
    expect(Math.max(...frequencies)).toBeLessThanOrEqual(784);
  });
});
