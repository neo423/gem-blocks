import Phaser from "phaser";
import {
  BASE_LEVEL_TIME_SECONDS,
  BOARD_COLS,
  BOARD_ROWS,
  EMPTY_GEM,
  scoreForRemoval,
  SHUFFLES_PER_LEVEL,
  SPECIAL_COLUMN,
  SPECIAL_NONE,
  SPECIAL_ROW,
  SPECIAL_ULTIMATE,
  targetForLevel,
  ULTIMATE_GEM
} from "./balance";
import { GemAudio } from "./audio";
import { removalFxPlan, type RemovalFxPlan } from "./fx";
import { pointerToBoardCell, type BoardInputMetrics } from "./input";
import {
  anyMatch,
  applyGravityWithPlan,
  areAdjacent,
  cellFromKey,
  cellKey,
  createEmptySpecialBoard,
  expandRemoval,
  findHint,
  findRuns,
  makeBoard,
  planMatches,
  shuffleBoard,
  skinTierForLevel,
  swapCells,
  ultimateSwapRemoval,
  type GravityPlan
} from "./logic";
import { createGemTextures, gemTextureKey, GEM_TEXTURE_SIZE } from "./gemArt";
import { GemRefillQueue } from "./refillQueue";
import type { Board, Cell, GemValue, SkinTier, SpecialBoard } from "./types";

type PlayState = "menu" | "playing" | "busy" | "paused" | "over";
type UiAction = "start" | "restart" | "next" | "pause" | "resume" | "hint" | "shuffle" | "sound";
type RenderBoardOptions = { dropIn?: boolean };

const WIDTH = 560;
const HEIGHT = 700;
const GEM_SIZE = 56;
const GAP = 6;
const BOARD_PAD = 16;
const INPUT_FORGIVENESS = 12;
const BOARD_PIXEL_WIDTH = BOARD_COLS * GEM_SIZE + (BOARD_COLS - 1) * GAP;
const BOARD_PIXEL_HEIGHT = BOARD_ROWS * GEM_SIZE + (BOARD_ROWS - 1) * GAP;
const BOARD_X = (WIDTH - BOARD_PIXEL_WIDTH) / 2;
const BOARD_Y = 41;
const SAVE_KEY = "gem-blocks-save-v1";
const GEM_ATLAS_KEY = "gem-atlas";

export class Match3Scene extends Phaser.Scene {
  private board: Board = makeBoard();
  private specials: SpecialBoard = createEmptySpecialBoard();
  private gems = new Map<number, Phaser.GameObjects.Container>();
  private state: PlayState = "menu";
  private selected?: Cell;
  private dragStart?: { cell: Cell; x: number; y: number; consumed: boolean };
  private pendingSwap: Cell[] = [];
  private level = 1;
  private totalScore = 0;
  private levelScore = 0;
  private target = targetForLevel(1);
  private timeLeft = BASE_LEVEL_TIME_SECONDS;
  private shufflesLeft = SHUFFLES_PER_LEVEL;
  private timer?: Phaser.Time.TimerEvent;
  private tier: SkinTier = skinTierForLevel(1);
  private boardFrame!: Phaser.GameObjects.Graphics;
  private boardInputZone?: Phaser.GameObjects.Zone;
  private sparkleTimer?: Phaser.Time.TimerEvent;
  private bestScore = 0;
  private bestLevel = 1;
  private audio = new GemAudio();
  private refillQueue = new GemRefillQueue();
  private actionHandler = (event: Event) => {
    this.handleUiAction((event as CustomEvent<UiAction>).detail);
  };

  constructor() {
    super("Match3Scene");
  }

  preload() {
    this.load.image("gem-atlas", "/assets/gems/gem-atlas.png");
  }

  create() {
    this.loadBest();
    this.createGemAtlasFrames();
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    this.drawBoardFrame();
    this.createBoardInputZone();
    this.resetLevel(1, false);
    window.addEventListener("gem-action", this.actionHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("gem-action", this.actionHandler);
      this.input.off("pointermove", this.onPointerMove, this);
      this.input.off("pointerup", this.onBoardPointerUp, this);
      this.clearTimer();
      this.sparkleTimer?.remove(false);
      this.audio.destroy();
    });
    this.showMenu();
  }

  private handleUiAction(action: UiAction) {
    if (action === "sound") {
      void this.toggleAudio();
      return;
    }
    if (action === "start" || action === "restart") {
      void this.audio.unlock();
      this.totalScore = 0;
      this.resetLevel(1, true);
      this.audio.playLevelStart();
      return;
    }
    if (action === "next") {
      void this.audio.unlock();
      this.resetLevel(this.level + 1, true);
      this.audio.playLevelStart();
      return;
    }
    if (action === "pause") {
      this.pauseGame();
      return;
    }
    if (action === "resume") {
      this.resumeGame();
      return;
    }
    if (action === "hint") {
      this.showHint();
      return;
    }
    if (action === "shuffle") {
      this.shufflePlayerBoard();
    }
  }

  private async toggleAudio() {
    await this.audio.toggle();
    if (this.audio.enabled && this.state === "playing") {
      this.audio.startMusic();
    }
    this.updateUi();
  }

  private resetLevel(level: number, startPlaying: boolean) {
    this.level = level;
    this.levelScore = 0;
    this.target = targetForLevel(level);
    this.timeLeft = Math.max(75, BASE_LEVEL_TIME_SECONDS - Math.floor((level - 1) * 4));
    this.shufflesLeft = SHUFFLES_PER_LEVEL;
    this.tier = skinTierForLevel(level);
    createGemTextures(this, this.tier);
    this.board = makeBoard();
    this.specials = createEmptySpecialBoard();
    this.refillQueue = new GemRefillQueue();
    this.selected = undefined;
    this.pendingSwap = [];
    this.clearTimer();
    this.renderBoard();
    this.updateUi();

    if (startPlaying) {
      this.state = "playing";
      this.startTimer();
      this.startSparkles();
      this.audio.startMusic();
      this.hideOverlay();
      return;
    }

    this.state = "menu";
  }

  private createGemAtlasFrames() {
    const texture = this.textures.get(GEM_ATLAS_KEY);
    if (!texture || texture.has("gem-0")) {
      return;
    }
    const source = texture.getSourceImage() as { width: number; height: number };
    const frameWidth = Math.floor(source.width / 3);
    const frameHeight = Math.floor(source.height / 3);
    for (let value = 0; value <= ULTIMATE_GEM; value += 1) {
      texture.add(
        `gem-${value}`,
        0,
        (value % 3) * frameWidth,
        Math.floor(value / 3) * frameHeight,
        frameWidth,
        frameHeight
      );
    }
  }

  private drawBoardFrame() {
    this.boardFrame = this.add.graphics();
    const x = BOARD_X - BOARD_PAD;
    const y = BOARD_Y - BOARD_PAD;
    const width = BOARD_PIXEL_WIDTH + BOARD_PAD * 2;
    const height = BOARD_PIXEL_HEIGHT + BOARD_PAD * 2;
    this.boardFrame.fillStyle(0x06315b, 0.88);
    this.boardFrame.fillRoundedRect(x + 8, y + 11, width, height, 18);
    this.boardFrame.fillStyle(0x031b37, 0.99);
    this.boardFrame.fillRoundedRect(x, y, width, height, 18);
    this.boardFrame.lineStyle(12, 0x5fdcff, 0.18);
    this.boardFrame.strokeRoundedRect(x - 2, y - 2, width + 4, height + 4, 20);
    this.boardFrame.lineStyle(9, 0xc77a10, 1);
    this.boardFrame.strokeRoundedRect(x, y, width, height, 18);
    this.boardFrame.lineStyle(3, 0xffed86, 1);
    this.boardFrame.strokeRoundedRect(x + 3, y + 3, width - 6, height - 6, 16);
    this.boardFrame.lineStyle(2, 0x65e7ff, 0.52);
    this.boardFrame.strokeRoundedRect(x + 9, y + 9, width - 18, height - 18, 12);

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const p = this.cellToWorld({ row, col });
        this.boardFrame.fillStyle((row + col) % 2 === 0 ? 0x073b68 : 0x052d55, 0.98);
        this.boardFrame.fillRoundedRect(p.x - GEM_SIZE / 2, p.y - GEM_SIZE / 2, GEM_SIZE, GEM_SIZE, 8);
        this.boardFrame.lineStyle(1, 0x79dfff, 0.16);
        this.boardFrame.strokeRoundedRect(p.x - GEM_SIZE / 2, p.y - GEM_SIZE / 2, GEM_SIZE, GEM_SIZE, 8);
      }
    }
  }

  private createBoardInputZone() {
    const width = BOARD_PIXEL_WIDTH + BOARD_PAD * 2;
    const height = BOARD_PIXEL_HEIGHT + BOARD_PAD * 2;
    this.boardInputZone = this.add
      .zone(BOARD_X + BOARD_PIXEL_WIDTH / 2, BOARD_Y + BOARD_PIXEL_HEIGHT / 2, width, height)
      .setOrigin(0.5)
      .setDepth(70)
      .setInteractive();
    this.boardInputZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.onBoardPointerDown(pointer));
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onBoardPointerUp, this);
  }

  private renderBoard(options: RenderBoardOptions = {}) {
    this.gems.forEach((gem) => gem.destroy());
    this.gems.clear();

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const value = this.board[row][col];
        if (value !== EMPTY_GEM) {
          this.createGem({ row, col }, value, options);
        }
      }
    }
  }

  private createGem(cell: Cell, value: GemValue, options: RenderBoardOptions = {}) {
    const p = this.cellToWorld(cell);
    const container = this.add.container(p.x, p.y);
    container.setSize(GEM_SIZE, GEM_SIZE);
    container.setDepth(20 + cell.row);
    container.setData("row", cell.row);
    container.setData("col", cell.col);

    const halo = this.add.circle(0, 2, GEM_SIZE * 0.45, this.tier.rimLight, 0.07);
    const frame = `gem-${value}`;
    const useAtlas = this.tier.key === "classic" && this.textures.get(GEM_ATLAS_KEY).has(frame);
    const gem = useAtlas
      ? this.add.image(0, 0, "gem-atlas", frame)
      : this.add.image(0, 0, gemTextureKey(this.tier.key, value));
    gem.setDisplaySize(GEM_TEXTURE_SIZE * 0.78, GEM_TEXTURE_SIZE * 0.78);
    container.add([halo, gem]);
    this.addSpecialBadge(container, this.specials[cell.row][cell.col]);

    if (options.dropIn) {
      container.y = p.y - (GEM_SIZE + GAP) * (1.1 + cell.row * 0.16);
      container.alpha = 0;
      container.setScale(0.82);
      this.tweens.add({
        targets: container,
        y: p.y,
        alpha: 1,
        scale: 1,
        duration: 270 + cell.row * 16,
        delay: cell.col * 10,
        ease: "Back.Out"
      });
    }

    this.gems.set(cellKey(cell), container);
    return container;
  }

  private addSpecialBadge(container: Phaser.GameObjects.Container, special: number) {
    if (special === SPECIAL_NONE) {
      return;
    }
    if (special === SPECIAL_ROW || special === SPECIAL_COLUMN) {
      this.drawElectricAura(container, special === SPECIAL_ROW);
      return;
    }

    const royalGlow = this.add.circle(0, 0, 39, 0xffd45b, 0.08);
    royalGlow.setStrokeStyle(2, 0xfff1a0, 0.76);
    container.add(royalGlow);
    this.tweens.add({
      targets: royalGlow,
      alpha: 0.3,
      scale: 1.08,
      yoyo: true,
      repeat: -1,
      duration: 620,
      ease: "Sine.easeInOut"
    });
  }

  private drawElectricAura(container: Phaser.GameObjects.Container, horizontal: boolean) {
    const corona = this.add.circle(0, 0, 36, 0xffc72e, 0.07);
    corona.setStrokeStyle(2, 0xffec94, 0.58);

    const primary = this.add.graphics();
    const secondary = this.add.graphics();
    this.drawElectricPair(primary, horizontal, 0, 0xffffff, 0.96);
    this.drawElectricPair(secondary, horizontal, 1, 0xffc928, 0.8);
    secondary.alpha = 0.26;

    const ends = horizontal
      ? [this.add.circle(-36, 0, 3, 0xffffff, 0.88), this.add.circle(36, 0, 3, 0xffffff, 0.88)]
      : [this.add.circle(0, -36, 3, 0xffffff, 0.88), this.add.circle(0, 36, 3, 0xffffff, 0.88)];

    container.add([corona, secondary, primary, ...ends]);
    this.tweens.add({ targets: corona, alpha: 0.22, scale: 1.08, yoyo: true, repeat: -1, duration: 380 });
    this.tweens.add({ targets: [primary, ...ends], alpha: 0.35, yoyo: true, repeat: -1, duration: 150 });
    this.tweens.add({ targets: secondary, alpha: 0.88, yoyo: true, repeat: -1, duration: 210, delay: 70 });
  }

  private drawElectricPair(
    graphics: Phaser.GameObjects.Graphics,
    horizontal: boolean,
    phase: number,
    color: number,
    alpha: number
  ) {
    graphics.lineStyle(3, color, alpha);
    if (horizontal) {
      this.drawElectricBolt(graphics, -34, -27, 34, -25, phase);
      this.drawElectricBolt(graphics, -34, 27, 34, 25, phase + 1);
      return;
    }
    this.drawElectricBolt(graphics, -28, -34, -26, 34, phase);
    this.drawElectricBolt(graphics, 28, -34, 26, 34, phase + 1);
  }

  private drawElectricBolt(
    graphics: Phaser.GameObjects.Graphics,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    phase: number
  ) {
    graphics.beginPath();
    graphics.moveTo(startX, startY);
    const segments = 6;
    for (let index = 1; index < segments; index += 1) {
      const progress = index / segments;
      const x = Phaser.Math.Linear(startX, endX, progress);
      const y = Phaser.Math.Linear(startY, endY, progress);
      const offset = (index + phase) % 2 === 0 ? 5 : -5;
      const horizontal = Math.abs(endX - startX) >= Math.abs(endY - startY);
      graphics.lineTo(horizontal ? x : x + offset, horizontal ? y + offset : y);
    }
    graphics.lineTo(endX, endY);
    graphics.strokePath();
  }

  private onBoardPointerDown(pointer: Phaser.Input.Pointer) {
    const cell = this.pointerToCell(pointer);
    if (this.state === "playing" && cell) {
      void this.audio.unlock();
      this.dragStart = { cell, x: pointer.worldX, y: pointer.worldY, consumed: false };
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (this.state !== "playing" || !this.dragStart || this.dragStart.consumed) {
      return;
    }
    const dx = pointer.worldX - this.dragStart.x;
    const dy = pointer.worldY - this.dragStart.y;
    if (Math.hypot(dx, dy) < 26) {
      return;
    }
    const target = { ...this.dragStart.cell };
    if (Math.abs(dx) > Math.abs(dy)) {
      target.col += dx > 0 ? 1 : -1;
    } else {
      target.row += dy > 0 ? 1 : -1;
    }
    this.dragStart.consumed = true;
    this.selected = undefined;
    this.clearSelection();
    if (this.isValidCell(target)) {
      this.trySwap(this.dragStart.cell, target);
    }
  }

  private onBoardPointerUp(pointer: Phaser.Input.Pointer) {
    if (!this.dragStart || this.dragStart.consumed) {
      this.dragStart = undefined;
      return;
    }
    const cell = this.pointerToCell(pointer) ?? this.dragStart.cell;
    this.dragStart = undefined;
    this.handleTap(cell);
  }

  private handleTap(cell: Cell) {
    if (this.state !== "playing") {
      return;
    }
    const tappedSpecial = this.specials[cell.row][cell.col];
    if (!this.selected && tappedSpecial !== SPECIAL_NONE && tappedSpecial !== SPECIAL_ULTIMATE) {
      this.detonateSpecial(cell);
      return;
    }
    if (!this.selected) {
      this.selectCell(cell);
      return;
    }
    const selected = this.selected;
    if (selected.row === cell.row && selected.col === cell.col) {
      this.selected = undefined;
      this.clearSelection();
      return;
    }
    if (areAdjacent(selected, cell)) {
      this.selected = undefined;
      this.clearSelection();
      this.trySwap(selected, cell);
      return;
    }
    this.selectCell(cell);
  }

  private selectCell(cell: Cell) {
    this.selected = cell;
    this.clearSelection();
    this.audio.playSelect();
    const gem = this.gems.get(cellKey(cell));
    if (!gem) {
      return;
    }
    gem.setScale(0.88);
    this.tweens.add({ targets: gem, scale: 1, duration: 180, ease: "Back.Out" });
    const ring = this.add.circle(0, 0, GEM_SIZE * 0.48);
    ring.setStrokeStyle(4, 0xffffff, 0.8);
    ring.setName("selection-ring");
    gem.add(ring);
  }

  private clearSelection() {
    this.gems.forEach((gem) => {
      gem.each((child: Phaser.GameObjects.GameObject) => {
        if (child instanceof Phaser.GameObjects.Arc && child.name === "selection-ring") {
          child.destroy();
        }
      });
    });
  }

  private trySwap(a: Cell, b: Cell) {
    if (this.state !== "playing" || !this.isValidCell(a) || !this.isValidCell(b) || !areAdjacent(a, b)) {
      return;
    }
    this.state = "busy";
    this.pendingSwap = [a, b];
    this.clearHint();
    this.audio.playSwap();

    this.animateSwap(a, b, () => {
      swapCells(this.board, a, b);
      swapCells(this.specials, a, b);
      this.swapGemContainers(a, b);
      const ultimateRemoval = ultimateSwapRemoval(this.board, this.specials, a, b);
      if (ultimateRemoval) {
        this.resolveUltimateSwap(ultimateRemoval, a, b);
        return;
      }
      if (anyMatch(this.board)) {
        this.resolveBoard(1);
        return;
      }

      this.time.delayedCall(90, () => {
        this.animateSwap(a, b, () => {
          swapCells(this.board, a, b);
          swapCells(this.specials, a, b);
          this.swapGemContainers(a, b);
          this.pendingSwap = [];
          this.state = "playing";
          this.audio.playInvalid();
        });
      });
    });
  }

  private animateSwap(a: Cell, b: Cell, onComplete: () => void) {
    const gemA = this.gems.get(cellKey(a));
    const gemB = this.gems.get(cellKey(b));
    if (!gemA || !gemB) {
      onComplete();
      return;
    }
    const posA = this.cellToWorld(a);
    const posB = this.cellToWorld(b);
    let completed = 0;
    const done = () => {
      completed += 1;
      if (completed === 2) {
        onComplete();
      }
    };
    this.tweens.add({ targets: gemA, x: posB.x, y: posB.y, duration: 145, ease: "Cubic.easeOut", onComplete: done });
    this.tweens.add({ targets: gemB, x: posA.x, y: posA.y, duration: 145, ease: "Cubic.easeOut", onComplete: done });
  }

  private swapGemContainers(a: Cell, b: Cell) {
    const keyA = cellKey(a);
    const keyB = cellKey(b);
    const gemA = this.gems.get(keyA);
    const gemB = this.gems.get(keyB);
    if (!gemA || !gemB) {
      return;
    }
    this.gems.set(keyA, gemB);
    this.gems.set(keyB, gemA);
  }

  private resolveUltimateSwap(initialRemoval: Set<number>, a: Cell, b: Cell) {
    this.pendingSwap = [];
    const aIsUltimate = this.specials[a.row][a.col] === SPECIAL_ULTIMATE;
    const bIsUltimate = this.specials[b.row][b.col] === SPECIAL_ULTIMATE;
    const source = aIsUltimate ? a : b;
    const target = aIsUltimate ? b : a;
    const targetValue = aIsUltimate && bIsUltimate ? ULTIMATE_GEM : this.board[target.row][target.col];

    const chainSpecials = this.specials.map((row) => [...row]) as SpecialBoard;
    chainSpecials[a.row][a.col] = aIsUltimate ? SPECIAL_NONE : chainSpecials[a.row][a.col];
    chainSpecials[b.row][b.col] = bIsUltimate ? SPECIAL_NONE : chainSpecials[b.row][b.col];
    const removeSet = expandRemoval(initialRemoval, new Set(), chainSpecials);
    const fxPlan = removalFxPlan(removeSet.size, 2);
    const gained = scoreForRemoval(removeSet.size, 1);

    this.levelScore += gained;
    this.totalScore += gained;
    this.updateBest(false);
    this.updateUi({ combo: 1, gained });
    this.animateColorLightning(source, removeSet, targetValue);
    this.time.delayedCall(110, () => {
      this.animateRemoval(removeSet, fxPlan, 2, () => this.settleAfterRemoval(removeSet, 2));
    });
  }

  private animateColorLightning(source: Cell, removeSet: Set<number>, value: GemValue) {
    const origin = this.cellToWorld(source);
    const color = this.colorForGem(value);
    const lightning = this.add.graphics().setDepth(92);
    lightning.lineStyle(5, color, 0.95);

    removeSet.forEach((key) => {
      const target = this.cellToWorld(cellFromKey(key));
      if (target.x === origin.x && target.y === origin.y) {
        return;
      }
      const midX = (origin.x + target.x) / 2 + Phaser.Math.Between(-12, 12);
      const midY = (origin.y + target.y) / 2 + Phaser.Math.Between(-12, 12);
      lightning.beginPath();
      lightning.moveTo(origin.x, origin.y);
      lightning.lineTo(midX, midY);
      lightning.lineTo(target.x, target.y);
      lightning.strokePath();
    });

    this.tweens.add({
      targets: lightning,
      alpha: 0,
      duration: 280,
      ease: "Cubic.easeOut",
      onComplete: () => lightning.destroy()
    });
  }

  private findPlayableHint(): [Cell, Cell] | null {
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        if (this.specials[row][col] !== SPECIAL_ULTIMATE) {
          continue;
        }
        const source = { row, col };
        const neighbors = [
          { row, col: col + 1 },
          { row: row + 1, col },
          { row, col: col - 1 },
          { row: row - 1, col }
        ];
        const target = neighbors.find((cell) => this.isValidCell(cell) && this.board[cell.row][cell.col] !== EMPTY_GEM);
        if (target) {
          return [source, target];
        }
      }
    }
    return findHint(this.board);
  }

  private resolveBoard(combo: number) {
    const runs = findRuns(this.board);
    if (runs.length === 0) {
      this.pendingSwap = [];
      if (!this.findPlayableHint()) {
        shuffleBoard(this.board, this.specials);
        this.audio.playShuffle();
        this.renderBoard({ dropIn: true });
      }
      if (this.levelScore >= this.target) {
        this.completeLevel();
        return;
      }
      this.state = "playing";
      this.updateUi();
      return;
    }

    const plan = planMatches(runs, combo === 1 ? this.pendingSwap : []);
    const removeSet = expandRemoval(plan.matched, plan.creationKeys, this.specials);
    const fxPlan = removalFxPlan(removeSet.size, combo);
    const gained = scoreForRemoval(removeSet.size + plan.creations.length, combo);
    this.levelScore += gained;
    this.totalScore += gained;
    this.updateBest(false);
    this.updateUi({ combo, gained });

    plan.creations.forEach((creation) => {
      this.specials[creation.row][creation.col] = creation.special;
      if (creation.special === SPECIAL_ULTIMATE) {
        this.board[creation.row][creation.col] = ULTIMATE_GEM;
      }
      const key = cellKey(creation);
      this.gems.get(key)?.destroy();
      this.gems.delete(key);
      this.createGem(creation, this.board[creation.row][creation.col]);
      const pulseColor = creation.special === SPECIAL_ULTIMATE ? 0xffffff : 0x8ff7ff;
      this.pulseCell(creation, pulseColor);
    });

    this.animateRemoval(removeSet, fxPlan, combo, () => {
      this.settleAfterRemoval(removeSet, combo + 1);
    });
  }

  private animateRemoval(removeSet: Set<number>, fxPlan: RemovalFxPlan, combo: number, onComplete: () => void) {
    if (removeSet.size === 0) {
      onComplete();
      return;
    }
    this.audio.playClear(fxPlan, combo);
    this.cameras.main.shake(fxPlan.cameraShakeDurationMs, fxPlan.cameraShakeIntensity);
    this.clusterBurst(removeSet, fxPlan);
    let remaining = removeSet.size;
    const finishOne = () => {
      remaining -= 1;
      if (remaining === 0) {
        onComplete();
      }
    };
    removeSet.forEach((key) => {
      const gem = this.gems.get(key);
      const cell = cellFromKey(key);
      if (!gem) {
        finishOne();
        return;
      }
      const delay = (cell.row + cell.col) * fxPlan.staggerMs;
      this.time.delayedCall(delay, () => {
        this.burstAt(cell, this.board[cell.row][cell.col], fxPlan);
        this.tweens.add({
          targets: gem,
          scale: 1.28,
          duration: 75,
          ease: "Back.Out",
          onComplete: () => {
            this.tweens.add({
              targets: gem,
              y: gem.y - 22,
              scale: 0.12,
              alpha: 0,
              angle: Phaser.Math.Between(-90, 90),
              duration: fxPlan.durationMs,
              ease: "Cubic.easeIn",
              onComplete: () => {
                gem.destroy();
                this.gems.delete(key);
                finishOne();
              }
            });
          }
        });
      });
    });
  }

  private settleAfterRemoval(removeSet: Set<number>, nextCombo: number) {
    removeSet.forEach((key) => {
      const cell = cellFromKey(key);
      this.board[cell.row][cell.col] = EMPTY_GEM;
      this.specials[cell.row][cell.col] = SPECIAL_NONE;
    });

    const gravityPlan = applyGravityWithPlan(this.board, this.specials, () => this.refillQueue.next());
    this.updateUi();
    this.animateGravity(gravityPlan, () => {
      this.time.delayedCall(80, () => this.resolveBoard(nextCombo));
    });
  }

  private animateGravity(gravityPlan: GravityPlan, onComplete: () => void) {
    const totalAnimations = gravityPlan.moves.length + gravityPlan.spawns.length;
    if (totalAnimations === 0) {
      onComplete();
      return;
    }

    let remaining = totalAnimations;
    const done = () => {
      remaining -= 1;
      if (remaining === 0) {
        onComplete();
      }
    };

    gravityPlan.moves.forEach((move) => {
      const fromKey = cellKey(move.from);
      const toKey = cellKey(move.to);
      const gem = this.gems.get(fromKey);
      if (!gem) {
        done();
        return;
      }

      const target = this.cellToWorld(move.to);
      const distance = Math.max(1, move.to.row - move.from.row);
      this.gems.delete(fromKey);
      this.gems.set(toKey, gem);
      gem.setData("row", move.to.row);
      gem.setData("col", move.to.col);
      gem.setDepth(20 + move.to.row);
      this.tweens.add({
        targets: gem,
        x: target.x,
        y: target.y,
        duration: 145 + distance * 52,
        ease: "Bounce.easeOut",
        onComplete: done
      });
    });

    gravityPlan.spawns.forEach((spawn, index) => {
      const gem = this.createGem(spawn.cell, spawn.value);
      const target = this.cellToWorld(spawn.cell);
      const rowsAbove = spawn.cell.row + 1;
      gem.y = BOARD_Y + GEM_SIZE / 2 - rowsAbove * (GEM_SIZE + GAP);
      gem.alpha = 0;
      gem.setScale(0.82);
      this.tweens.add({
        targets: gem,
        y: target.y,
        alpha: 1,
        scale: 1,
        duration: 240 + rowsAbove * 44,
        delay: (index % BOARD_COLS) * 12,
        ease: "Back.Out",
        onComplete: done
      });
    });
  }

  private detonateSpecial(cell: Cell) {
    const special = this.specials[cell.row][cell.col];
    if (this.state !== "playing" || special === SPECIAL_NONE || special === SPECIAL_ULTIMATE) {
      return;
    }
    this.state = "busy";
    this.clearHint();
    const removeSet = expandRemoval(new Set([cellKey(cell)]), new Set(), this.specials);
    const fxPlan = removalFxPlan(removeSet.size, 2);
    const gained = scoreForRemoval(removeSet.size, 1);
    this.levelScore += gained;
    this.totalScore += gained;
    this.updateBest(false);
    this.updateUi({ combo: 1, gained });
    this.animateRemoval(removeSet, fxPlan, 2, () => {
      this.settleAfterRemoval(removeSet, 2);
    });
  }

  private showHint() {
    if (this.state !== "playing") {
      return;
    }
    this.audio.playHint();
    this.clearHint();
    const hint = this.findPlayableHint();
    if (!hint) {
      return;
    }
    hint.forEach((cell) => {
      const gem = this.gems.get(cellKey(cell));
      if (!gem) {
        return;
      }
      gem.setData("hint", true);
      this.tweens.add({
        targets: gem,
        scale: 1.16,
        yoyo: true,
        repeat: 5,
        duration: 150,
        ease: "Sine.easeInOut",
        onComplete: () => gem.setData("hint", false)
      });
    });
  }

  private clearHint() {
    this.gems.forEach((gem) => {
      if (gem.getData("hint")) {
        this.tweens.killTweensOf(gem);
        gem.setScale(1);
        gem.setData("hint", false);
      }
    });
  }

  private shufflePlayerBoard() {
    if (this.state !== "playing" || this.shufflesLeft <= 0) {
      return;
    }
    this.shufflesLeft -= 1;
    shuffleBoard(this.board, this.specials);
    this.audio.playShuffle();
    this.renderBoard({ dropIn: true });
    this.updateUi();
  }

  private pauseGame() {
    if (this.state !== "playing") {
      return;
    }
    this.state = "paused";
    this.clearTimer();
    this.audio.stopMusic();
    this.audio.playSelect();
    this.dispatchOverlay({
      mode: "pause",
      title: "已暫停",
      text: "寶石礦脈先穩住，準備好再繼續。",
      button: "繼續遊戲"
    });
    this.updateUi();
  }

  private resumeGame() {
    if (this.state !== "paused") {
      return;
    }
    this.state = "playing";
    this.hideOverlay();
    this.startTimer();
    void this.audio.unlock();
    this.audio.startMusic();
    this.audio.playLevelStart();
    this.updateUi();
  }

  private completeLevel() {
    this.state = "over";
    this.clearTimer();
    this.audio.stopMusic();
    this.audio.playLevelClear();
    this.updateBest(true);
    const nextTier = skinTierForLevel(this.level + 1);
    this.dispatchOverlay({
      mode: "level",
      title: "關卡完成",
      text:
        nextTier.key !== this.tier.key
          ? `下一關解鎖「${nextTier.name}」寶石。`
          : `目前寶石系列：${this.tier.name}。`,
      big: `總分 ${this.totalScore}`,
      button: `進入第 ${this.level + 1} 關`
    });
    this.updateUi();
  }

  private gameOver() {
    this.state = "over";
    this.clearTimer();
    this.audio.stopMusic();
    this.audio.playGameOver();
    this.updateBest(true);
    this.dispatchOverlay({
      mode: "gameover",
      title: "時間到",
      text: `你抵達第 ${this.level} 關，最佳紀錄會保留在本機。`,
      big: `總分 ${this.totalScore}`,
      button: "重新開局"
    });
    this.updateUi();
  }

  private showMenu() {
    this.dispatchOverlay({
      mode: "menu",
      title: "寶石方塊",
      text: "交換相鄰寶石，湊三連以上消除。關卡越高，礦脈會出現更稀有的寶石。",
      big: "Gem Blocks",
      button: "開始開採"
    });
    this.updateUi();
  }

  private startTimer() {
    this.clearTimer();
    this.timer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.state !== "playing") {
          return;
        }
        this.timeLeft -= 1;
        this.updateUi();
        if (this.timeLeft <= 0) {
          this.gameOver();
        }
      }
    });
  }

  private clearTimer() {
    this.timer?.remove(false);
    this.timer = undefined;
  }

  private startSparkles() {
    this.sparkleTimer?.remove(false);
    this.sparkleTimer = this.time.addEvent({
      delay: 520,
      loop: true,
      callback: () => {
        if (this.state === "playing") {
          this.randomSparkle();
        }
      }
    });
  }

  private randomSparkle() {
    const values = [...this.gems.values()];
    if (values.length === 0) {
      return;
    }
    const gem = Phaser.Utils.Array.GetRandom(values);
    const star = this.add.star(gem.x + Phaser.Math.Between(-16, 18), gem.y + Phaser.Math.Between(-18, 13), 4, 2, 8, 0xffffff, 0.85);
    star.setDepth(80);
    this.tweens.add({
      targets: star,
      scale: 1.7 + this.tier.sparkle,
      alpha: 0,
      angle: 90,
      duration: 520,
      ease: "Cubic.easeOut",
      onComplete: () => star.destroy()
    });
  }

  private burstAt(cell: Cell, value: GemValue, fxPlan: RemovalFxPlan) {
    const p = this.cellToWorld(cell);
    const color = value >= 0 ? this.colorForGem(value) : 0xffffff;
    const core = this.add.star(p.x, p.y, 6, 7, 28, 0xffffff, 0.88);
    core.setDepth(88);
    this.tweens.add({
      targets: core,
      scale: 1.65,
      alpha: 0,
      angle: 140,
      duration: fxPlan.durationMs * 0.8,
      ease: "Cubic.easeOut",
      onComplete: () => core.destroy()
    });

    const highlight = this.add.circle(p.x, p.y, 12, 0xffffff, 0.62);
    highlight.setDepth(86);
    this.tweens.add({
      targets: highlight,
      radius: fxPlan.flashRadius,
      alpha: 0,
      duration: fxPlan.durationMs * 0.65,
      ease: "Cubic.easeOut",
      onComplete: () => highlight.destroy()
    });

    const ring = this.add.circle(p.x, p.y, 8);
    ring.setStrokeStyle(5, 0xfff3b0, 0.86);
    ring.setDepth(86);
    this.tweens.add({
      targets: ring,
      radius: fxPlan.ringRadius,
      alpha: 0,
      duration: fxPlan.durationMs,
      ease: "Expo.easeOut",
      onComplete: () => ring.destroy()
    });

    for (let i = 0; i < fxPlan.shardsPerGem; i += 1) {
      const angle = (Math.PI * 2 * i) / fxPlan.shardsPerGem + Phaser.Math.FloatBetween(-0.18, 0.18);
      const distance = Phaser.Math.Between(28, 58 + Math.floor(fxPlan.ringRadius * 0.45));
      const shard = this.add.triangle(p.x, p.y, 0, -7, 5, 6, -5, 6, color, 0.92);
      shard.setDepth(85);
      shard.setScale(Phaser.Math.FloatBetween(0.72, 1.18));
      this.tweens.add({
        targets: shard,
        x: p.x + Math.cos(angle) * distance,
        y: p.y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.18,
        angle: Phaser.Math.Between(-260, 260),
        duration: fxPlan.durationMs + Phaser.Math.Between(-40, 110),
        ease: "Cubic.easeOut",
        onComplete: () => shard.destroy()
      });
    }

    for (let i = 0; i < fxPlan.dustPerGem; i += 1) {
      const dust = this.add.star(
        p.x + Phaser.Math.Between(-12, 12),
        p.y + Phaser.Math.Between(-12, 12),
        4,
        2,
        Phaser.Math.Between(5, 9),
        0xffffff,
        0.78
      );
      dust.setDepth(87);
      this.tweens.add({
        targets: dust,
        x: dust.x + Phaser.Math.Between(-32, 32),
        y: dust.y - Phaser.Math.Between(22, 54),
        alpha: 0,
        scale: 1.8,
        angle: 120,
        duration: fxPlan.durationMs + Phaser.Math.Between(80, 180),
        ease: "Sine.easeOut",
        onComplete: () => dust.destroy()
      });
    }
  }

  private clusterBurst(removeSet: Set<number>, fxPlan: RemovalFxPlan) {
    if (removeSet.size === 0) {
      return;
    }
    let totalX = 0;
    let totalY = 0;
    removeSet.forEach((key) => {
      const p = this.cellToWorld(cellFromKey(key));
      totalX += p.x;
      totalY += p.y;
    });

    const centerX = totalX / removeSet.size;
    const centerY = totalY / removeSet.size;
    const wave = this.add.circle(centerX, centerY, 18);
    wave.setStrokeStyle(7, 0x8ff7ff, 0.62);
    wave.setDepth(83);
    this.tweens.add({
      targets: wave,
      radius: fxPlan.ringRadius * 1.35,
      alpha: 0,
      duration: fxPlan.durationMs + 220,
      ease: "Expo.easeOut",
      onComplete: () => wave.destroy()
    });

    const sweep = this.add.rectangle(centerX, centerY, fxPlan.ringRadius * 2.4, 9, 0xffffff, 0.22);
    sweep.setDepth(84);
    sweep.setAngle(Phaser.Math.Between(-28, 28));
    this.tweens.add({
      targets: sweep,
      scaleX: 1.55,
      scaleY: 0.1,
      alpha: 0,
      duration: fxPlan.durationMs + 120,
      ease: "Sine.easeOut",
      onComplete: () => sweep.destroy()
    });
  }

  private pulseCell(cell: Cell, color: number) {
    const p = this.cellToWorld(cell);
    const ring = this.add.circle(p.x, p.y, 10);
    ring.setStrokeStyle(4, color, 0.9);
    ring.setDepth(82);
    this.tweens.add({
      targets: ring,
      radius: 45,
      alpha: 0,
      duration: 360,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  private updateUi(extra: { combo?: number; gained?: number } = {}) {
    window.dispatchEvent(
      new CustomEvent("gem-ui", {
        detail: {
          level: this.level,
          totalScore: this.totalScore,
          levelScore: this.levelScore,
          target: this.target,
          timeLeft: this.timeLeft,
          shufflesLeft: this.shufflesLeft,
          tierName: this.tier.name,
          bestScore: this.bestScore,
          bestLevel: this.bestLevel,
          audioEnabled: this.audio.enabled,
          state: this.state,
          progress: Math.min(1, this.levelScore / this.target),
          nextGems: this.refillQueue.preview(),
          previewRevision: this.refillQueue.revision,
          ...extra
        }
      })
    );
  }

  private dispatchOverlay(detail: Record<string, string>) {
    window.dispatchEvent(new CustomEvent("gem-overlay", { detail }));
  }

  private hideOverlay() {
    window.dispatchEvent(new CustomEvent("gem-overlay-hide"));
  }

  private loadBest() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "{}") as { bestScore?: number; bestLevel?: number };
      this.bestScore = Number(parsed.bestScore ?? 0);
      this.bestLevel = Number(parsed.bestLevel ?? 1);
    } catch {
      this.bestScore = 0;
      this.bestLevel = 1;
    }
  }

  private updateBest(includeLevel: boolean) {
    this.bestScore = Math.max(this.bestScore, this.totalScore);
    if (includeLevel) {
      this.bestLevel = Math.max(this.bestLevel, this.level);
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ bestScore: this.bestScore, bestLevel: this.bestLevel }));
    } catch {
      // Local storage can be unavailable in private contexts; gameplay continues without persistence.
    }
  }

  private cellToWorld(cell: Cell) {
    return {
      x: BOARD_X + cell.col * (GEM_SIZE + GAP) + GEM_SIZE / 2,
      y: BOARD_Y + cell.row * (GEM_SIZE + GAP) + GEM_SIZE / 2
    };
  }

  private pointerToCell(pointer: Phaser.Input.Pointer) {
    return pointerToBoardCell(pointer.worldX, pointer.worldY, this.boardInputMetrics(), INPUT_FORGIVENESS);
  }

  private boardInputMetrics(): BoardInputMetrics {
    return {
      boardX: BOARD_X,
      boardY: BOARD_Y,
      gemSize: GEM_SIZE,
      gap: GAP,
      boardRows: BOARD_ROWS,
      boardCols: BOARD_COLS
    };
  }

  private isValidCell(cell: Cell) {
    return cell.row >= 0 && cell.row < BOARD_ROWS && cell.col >= 0 && cell.col < BOARD_COLS;
  }

  private colorForGem(value: GemValue) {
    const colors = [0xe83f5f, 0xf4c542, 0x08b77d, 0x2b82d9, 0x8c4be8, 0xbfefff];
    return colors[value] ?? 0xffffff;
  }
}

export const MATCH3_GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "rgba(0,0,0,0)",
  transparent: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [Match3Scene]
};
