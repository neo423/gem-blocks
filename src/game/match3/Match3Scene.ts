import Phaser from "phaser";
import {
  BASE_LEVEL_TIME_SECONDS,
  BOARD_SIZE,
  EMPTY_GEM,
  scoreForRemoval,
  SHUFFLES_PER_LEVEL,
  SPECIAL_BOMB,
  SPECIAL_NONE,
  targetForLevel
} from "./balance";
import { GemAudio } from "./audio";
import { removalFxPlan, type RemovalFxPlan } from "./fx";
import { pointerToBoardCell, type BoardInputMetrics } from "./input";
import {
  anyMatch,
  applyGravity,
  areAdjacent,
  cellKey,
  createEmptySpecialBoard,
  expandRemoval,
  findHint,
  findRuns,
  makeBoard,
  planMatches,
  shuffleBoard,
  skinTierForLevel,
  swapCells
} from "./logic";
import { createGemTextures, gemDisplayName, gemTextureKey, GEM_TEXTURE_SIZE } from "./gemArt";
import type { Board, Cell, GemValue, SkinTier, SpecialBoard } from "./types";

type PlayState = "menu" | "playing" | "busy" | "paused" | "over";
type UiAction = "start" | "restart" | "next" | "pause" | "resume" | "hint" | "shuffle" | "sound";
type RenderBoardOptions = { dropIn?: boolean };

const WIDTH = 720;
const HEIGHT = 820;
const GEM_SIZE = 68;
const GAP = 7;
const BOARD_PAD = 18;
const INPUT_FORGIVENESS = 12;
const BOARD_PIXEL_SIZE = BOARD_SIZE * GEM_SIZE + (BOARD_SIZE - 1) * GAP;
const BOARD_X = (WIDTH - BOARD_PIXEL_SIZE) / 2;
const BOARD_Y = 112;
const SAVE_KEY = "gem-blocks-save-v1";

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
  private actionHandler = (event: Event) => {
    this.handleUiAction((event as CustomEvent<UiAction>).detail);
  };

  constructor() {
    super("Match3Scene");
  }

  create() {
    this.loadBest();
    this.cameras.main.setBackgroundColor("#090a12");
    this.drawBackground();
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

  private drawBackground() {
    const g = this.add.graphics();
    g.fillStyle(0x090a12);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle(0x13241f, 0.9);
    g.fillRect(0, 0, WIDTH, 74);
    g.fillStyle(0x3e2e19, 0.75);
    g.fillRect(0, HEIGHT - 92, WIDTH, 92);

    for (let i = 0; i < 26; i += 1) {
      const x = 14 + i * 34;
      const y = HEIGHT - 72 + (i % 3) * 14;
      g.lineStyle(1, i % 2 === 0 ? 0xc99b48 : 0x215b53, 0.22);
      g.strokeTriangle(x, y + 22, x + 22, y - 4, x + 45, y + 22);
    }

    for (let i = 0; i < 18; i += 1) {
      const x = 22 + i * 40;
      g.fillStyle(i % 2 === 0 ? 0x6c2040 : 0x0f5d63, 0.18);
      g.fillRect(x, 86 + (i % 4) * 118, 24, 64);
    }
  }

  private drawBoardFrame() {
    this.boardFrame = this.add.graphics();
    const x = BOARD_X - BOARD_PAD;
    const y = BOARD_Y - BOARD_PAD;
    const size = BOARD_PIXEL_SIZE + BOARD_PAD * 2;
    this.boardFrame.fillStyle(0x020309, 0.72);
    this.boardFrame.fillRoundedRect(x + 8, y + 10, size, size, 18);
    this.boardFrame.fillStyle(0x121526, 0.96);
    this.boardFrame.fillRoundedRect(x, y, size, size, 18);
    this.boardFrame.lineStyle(4, 0xd8b56a, 0.74);
    this.boardFrame.strokeRoundedRect(x, y, size, size, 18);
    this.boardFrame.lineStyle(1, 0x6df2d0, 0.24);
    this.boardFrame.strokeRoundedRect(x + 9, y + 9, size - 18, size - 18, 12);

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const p = this.cellToWorld({ row, col });
        this.boardFrame.fillStyle((row + col) % 2 === 0 ? 0x111827 : 0x0c111b, 0.92);
        this.boardFrame.fillRoundedRect(p.x - GEM_SIZE / 2, p.y - GEM_SIZE / 2, GEM_SIZE, GEM_SIZE, 8);
      }
    }
  }

  private createBoardInputZone() {
    const size = BOARD_PIXEL_SIZE + BOARD_PAD * 2;
    this.boardInputZone = this.add
      .zone(BOARD_X + BOARD_PIXEL_SIZE / 2, BOARD_Y + BOARD_PIXEL_SIZE / 2, size, size)
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

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
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
    const gem = this.add.image(0, 0, gemTextureKey(this.tier.key, value));
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
  }

  private addSpecialBadge(container: Phaser.GameObjects.Container, special: number) {
    if (special === SPECIAL_NONE) {
      return;
    }
    const color = special === SPECIAL_BOMB ? 0xffd166 : 0x8ff7ff;
    const badge = this.add.circle(19, 19, 13, color, 0.94);
    badge.setStrokeStyle(3, 0x111322, 0.9);
    const label = this.add.text(19, 19, special === SPECIAL_BOMB ? "B" : "+", {
      fontFamily: "Trebuchet MS, Microsoft JhengHei, sans-serif",
      fontSize: special === SPECIAL_BOMB ? "15px" : "19px",
      fontStyle: "bold",
      color: "#111322"
    });
    label.setOrigin(0.5);
    container.add([badge, label]);
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
    if (!this.selected && this.specials[cell.row][cell.col] !== SPECIAL_NONE) {
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

  private resolveBoard(combo: number) {
    const runs = findRuns(this.board);
    if (runs.length === 0) {
      this.pendingSwap = [];
      if (!findHint(this.board)) {
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
    const gained = scoreForRemoval(removeSet.size, combo);
    this.levelScore += gained;
    this.totalScore += gained;
    this.updateBest(false);
    this.updateUi({ combo, gained });

    plan.creations.forEach((creation) => {
      this.specials[creation.row][creation.col] = creation.special;
      this.pulseCell(creation, creation.special === SPECIAL_BOMB ? 0xffd166 : 0x8ff7ff);
    });

    this.animateRemoval(removeSet, fxPlan, combo, () => {
      removeSet.forEach((key) => {
        const cell = { row: Math.floor(key / BOARD_SIZE), col: key % BOARD_SIZE };
        this.board[cell.row][cell.col] = EMPTY_GEM;
        this.specials[cell.row][cell.col] = SPECIAL_NONE;
      });
      applyGravity(this.board, this.specials, () => Math.floor(Math.random() * 6) as GemValue);
      this.renderBoard({ dropIn: true });
      this.time.delayedCall(150, () => this.resolveBoard(combo + 1));
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
      const cell = { row: Math.floor(key / BOARD_SIZE), col: key % BOARD_SIZE };
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

  private detonateSpecial(cell: Cell) {
    if (this.state !== "playing" || this.specials[cell.row][cell.col] === SPECIAL_NONE) {
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
      removeSet.forEach((key) => {
        const target = { row: Math.floor(key / BOARD_SIZE), col: key % BOARD_SIZE };
        this.board[target.row][target.col] = EMPTY_GEM;
        this.specials[target.row][target.col] = SPECIAL_NONE;
      });
      applyGravity(this.board, this.specials, () => Math.floor(Math.random() * 6) as GemValue);
      this.renderBoard({ dropIn: true });
      this.time.delayedCall(170, () => this.resolveBoard(2));
    });
  }

  private showHint() {
    if (this.state !== "playing") {
      return;
    }
    this.audio.playHint();
    this.clearHint();
    const hint = findHint(this.board);
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
      const p = this.cellToWorld({ row: Math.floor(key / BOARD_SIZE), col: key % BOARD_SIZE });
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
          nextGem: gemDisplayName(this.tier.key, 0),
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
      boardSize: BOARD_SIZE
    };
  }

  private isValidCell(cell: Cell) {
    return cell.row >= 0 && cell.row < BOARD_SIZE && cell.col >= 0 && cell.col < BOARD_SIZE;
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
  backgroundColor: "#090a12",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [Match3Scene]
};
