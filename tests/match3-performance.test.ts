import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const scene = readFileSync(new URL("../src/game/match3/Match3Scene.ts", import.meta.url), "utf8");

describe("Match3 mobile performance", () => {
  test("caps the Phaser loop at 30 FPS with a real timeout throttle", () => {
    expect(scene).toMatch(/fps:\s*\{\s*target:\s*30,\s*forceSetTimeOut:\s*true\s*\}/);
  });

  test("keeps the round countdown on a one-second clock", () => {
    expect(scene).toMatch(/delay:\s*1000,\s*loop:\s*true,/);
  });
});
