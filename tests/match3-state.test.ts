import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Use Phaser's real clock without booting its DOM/WebGL renderer in Node.
const require = createRequire(import.meta.url);
const Clock = require("phaser/src/time/Clock.js");
vi.mock("phaser", () => ({ default: {
  Scene: class { sys = { events: new EventEmitter() }; },
  AUTO: 0, Scale: { FIT: 0, CENTER_BOTH: 0 }
} }));
import { Match3Scene } from "../src/game/match3/Match3Scene";
import { createEmptySpecialBoard, skinTierForLevel } from "../src/game/match3/logic";
import { SPECIAL_ROW, SPECIAL_COLUMN, SPECIAL_ULTIMATE } from "../src/game/match3/balance";

function makeScene() {
  const scene = new Match3Scene() as any;
  scene.time = new Clock(scene);
  scene.textures = { exists: () => true, getBase64: () => "data:image/png;base64,test" };
  scene.audio = {
    enabled: false, unlock: async () => {}, startMusic() {}, stopMusic() {},
    playSelect() {}, playLevelStart() {}, playShuffle() {}, playHint() {}, playLevelClear() {}, playGameOver() {}
  };
  scene.renderBoard = vi.fn();
  scene.startSparkles = vi.fn();
  scene.state = "playing";
  return scene;
}

function advance(scene: any, ms: number) {
  scene.time.preUpdate();
  scene.time.update(scene.time.now + ms, ms);
}

describe("match-3 state transitions", () => {
  beforeEach(() => vi.stubGlobal("window", new EventTarget()));
  afterEach(() => vi.unstubAllGlobals());

  test("repeated pauses preserve fractional seconds of active play", () => {
    const scene = makeScene();
    scene.startTimer();
    for (let i = 0; i < 10; i++) {
      advance(scene, 300);
      scene.pauseGame();
      advance(scene, 5000);
      scene.resumeGame();
    }
    expect(scene.timeLeft).toBe(147);
  });

  test.each([1, 4])("level %i immediately publishes playable UI state", (level) => {
    const scene = makeScene();
    scene.state = level === 1 ? "menu" : "over";
    const states: any[] = [];
    window.addEventListener("gem-ui", (event) => states.push((event as CustomEvent).detail));
    scene.resetLevel(level, true);
    expect(states.at(-1)).toMatchObject({ state: "playing", level, shufflesLeft: 3 });
  });

  test("a new round resets the timer instead of carrying the previous fraction", () => {
    const scene = makeScene();
    scene.startTimer();
    advance(scene, 900);
    scene.resetLevel(1, true);
    advance(scene, 100);
    expect(scene.timeLeft).toBe(150);
    advance(scene, 900);
    expect(scene.timeLeft).toBe(149);
  });

  test.each([SPECIAL_ROW, SPECIAL_COLUMN])("a lone directional gem (%i) prevents automatic shuffling", (special) => {
    const scene = makeScene();
    scene.board = Array.from({ length: 10 }, (_, row) =>
      Array.from({ length: 8 }, (_, col) => (row + col) % 6));
    scene.specials = createEmptySpecialBoard();
    scene.specials[4][3] = special;
    const before = scene.board.map((row: number[]) => [...row]);
    expect(scene.findPlayableHint()).toEqual([{ row: 4, col: 3 }]);
    scene.resolveBoard(1);
    expect(scene.board).toEqual(before);
    expect(scene.specials[4][3]).toBe(special);
    expect(scene.state).toBe("playing");
  });

  test("ultimate gems still produce a two-cell swap hint", () => {
    const scene = makeScene();
    scene.specials[9][7] = SPECIAL_ULTIMATE;
    scene.board[9][7] = 6;
    expect(scene.findPlayableHint()).toEqual([{ row: 9, col: 7 }, { row: 9, col: 6 }]);
  });

  test("a tap hint clears a previous selection so the tap detonates instead of swapping", () => {
    const scene = makeScene();
    scene.selected = { row: 4, col: 2 };
    scene.specials[4][3] = SPECIAL_ROW;
    scene.showHint();
    expect(scene.selected).toBeUndefined();
  });

  test.each([
    [1, "gem-atlas"], [4, "gem-atlas"], [7, "gem-atlas"], [11, "gem-atlas"]
  ])("level %i preserves the detailed gem artwork across tier changes", (level, textureKey) => {
    const scene = makeScene();
    scene.tier = skinTierForLevel(level as number);
    scene.textures.get = () => ({ has: () => true });
    // Replace only rendering objects; execute the real texture selection path.
    scene.add = {
      circle: () => ({}),
      image: (_x: number, _y: number, key: string) => ({
        texture: { key }, setOrigin() {}, setDisplaySize() {}
      }),
      container: () => ({
        list: [] as any[], setSize() {}, setDepth() {}, setData() {},
        add(children: any[]) { this.list.push(...children); }
      })
    };
    const gem = scene.createGem({ row: 0, col: 0 }, 0);
    expect(gem.list[1].texture.key).toBe(textureKey);
  });

  test("results retain the highest cascade and recognize records already saved during play", () => {
    const scene = makeScene();
    scene.bestScore = 100;
    scene.resetLevel(1, true);
    scene.board = Array.from({ length: 10 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + c) % 6));
    scene.board[0].splice(0, 3, 0, 0, 0);
    scene.animateRemoval = () => {};
    scene.resolveBoard(3); // 3 gems at x3 = 68 points.
    scene.resolveBoard(2); // 3 gems at x2 = 52 points.
    let result: any;
    window.addEventListener("gem-overlay", event => { result = (event as CustomEvent).detail; });
    scene.completeLevel();
    expect(result.summary).toMatchObject({ levelScore: 120, totalScore: 120, highestCombo: 3, newBest: true, bestScore: 120 });
    scene.resetLevel(2, true);
    scene.pauseGame();
    expect(result.summary).toMatchObject({ levelScore: 0, totalScore: 120, highestCombo: 0, newBest: false });
  });

  test.each([[4, "橫排"], [5, "同色"]])("a %i-run announces how to use its new special", (length, word) => {
    const scene = makeScene();
    scene.board = Array.from({ length: 10 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + c) % 6));
    scene.board[0].fill(0, 0, length as number);
    scene.animateRemoval = () => {};
    scene.createGem = () => {};
    scene.pulseCell = () => {};
    let state: any;
    window.addEventListener("gem-ui", event => { state = (event as CustomEvent).detail; });
    scene.resolveBoard(1);
    expect(state.specialNotice).toContain(word);
  });

  test("the tall white gem leaves room between neighboring cells without distortion", () => {
    const scene = makeScene();
    scene.textures.get = () => ({ has: () => true });
    scene.add = {
      circle: () => ({}),
      image: () => ({ width: 0, height: 0, setOrigin() {},
        setDisplaySize(w: number, h: number) { this.width = w; this.height = h; } }),
      container: () => ({ list: [] as any[], setSize() {}, setDepth() {}, setData() {},
        add(children: any[]) { this.list.push(...children); } })
    };
    const image = scene.createGem({ row: 0, col: 0 }, 5).list[1];
    // Original atlas alpha bounds: 354px tall in a 418px tile; cell is 56px.
    expect(image.height * 354 / 418).toBeLessThanOrEqual(52);
    expect(image.width).toBe(image.height);
  });
});
