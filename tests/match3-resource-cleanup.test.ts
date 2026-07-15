import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const scene = readFileSync(new URL("../src/game/match3/Match3Scene.ts", import.meta.url), "utf8");

describe("Match3Scene resource cleanup", () => {
  test("stops container and child tweens before destroying a gem", () => {
    expect(scene).toContain("private destroyGemContainer(container: Phaser.GameObjects.Container)");
    expect(scene).toContain("this.tweens.killTweensOf([container, ...container.list]);");
    expect(scene.match(/this\.destroyGemContainer\(/g)).toHaveLength(3);
  });
});
