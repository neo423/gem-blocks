# Gem Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent browser match-3 game with realistic faceted gems, level-based gem skin progression, and GitHub Pages-ready output.

**Architecture:** Keep match-3 rules in pure TypeScript modules and keep Phaser responsible for rendering, animation, pointer input, and effects. Use a DOM overlay for readable HUD controls, pause/menu/result panels, and responsive layout.

**Tech Stack:** Phaser 3, TypeScript, Vite, Vitest, DOM overlay CSS.

---

### File Structure

- Modify: `index.html` for the new game title and DOM shell.
- Modify: `src/style.css` for responsive game canvas plus DOM HUD/menu styling.
- Replace: `src/main.ts` with a focused Phaser bootstrap and DOM overlay wiring.
- Create: `src/game/match3/types.ts` for shared gameplay types.
- Create: `src/game/match3/balance.ts` for board size, colors, scoring, timer, target, and gem skin tier rules.
- Create: `src/game/match3/logic.ts` for pure board generation, run detection, swap validation, special gem planning, removal expansion, gravity, hints, and shuffle.
- Create: `src/game/match3/gemArt.ts` for Phaser-drawn faceted gemstone sprites and level skin palettes.
- Create: `src/game/match3/Match3Scene.ts` for the playable Phaser scene.
- Create: `src/game/match3/logic.test.ts` for red-green tests of the pure rules.
- Modify: `package.json` to add a `test` script and Vitest.

### Task 1: Pure Match-3 Logic

**Files:**
- Create: `src/game/match3/types.ts`
- Create: `src/game/match3/balance.ts`
- Create: `src/game/match3/logic.test.ts`
- Create: `src/game/match3/logic.ts`
- Modify: `package.json`

- [x] **Step 1: Write failing tests for run detection, special gem creation, gravity, hints, and level skin tiers**

Run: `pnpm test -- --run`
Expected before implementation: FAIL because Vitest or modules are missing.

- [x] **Step 2: Implement minimal pure logic**

Implement deterministic board functions without Phaser imports.

- [x] **Step 3: Run tests to verify the pure logic passes**

Run: `pnpm test -- --run`
Expected: all tests pass.

### Task 2: Phaser Scene And Gem Rendering

**Files:**
- Create: `src/game/match3/gemArt.ts`
- Create: `src/game/match3/Match3Scene.ts`
- Replace: `src/main.ts`
- Modify: `index.html`
- Modify: `src/style.css`

- [x] **Step 1: Render an 8x8 board with faceted gemstone containers**

Use gradient-like layered polygons, sharp highlights, dark rim strokes, inner glints, and a subtle idle shine.

- [x] **Step 2: Add pointer and drag input**

Support click-to-select and drag-to-swap adjacent gems.

- [x] **Step 3: Add swap, resolve, fall, refill, combo, score, and target flow**

Use scene state to block input while animation is resolving.

- [x] **Step 4: Add special gems and effects**

4-runs create bombs; 5-runs create line gems. Detonations use particles, flashes, and screen feedback.

### Task 3: UI, Progression, And Responsiveness

**Files:**
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `src/game/match3/Match3Scene.ts`

- [x] **Step 1: Build HUD**

Show level, score, target progress, time, skin tier, hint, shuffle, and pause.

- [x] **Step 2: Build start/pause/result overlays**

Homepage opens into the game shell, with a start overlay over the board instead of a marketing page.

- [x] **Step 3: Add level-based gem skins**

Keep six logical colors but change gem material at levels 4, 7, and 11.

- [x] **Step 4: Add local best score**

Use `localStorage` for high score and best reached level.

### Task 4: Verification And Publishing Prep

**Files:**
- Modify: `package.json`
- Generated: `dist/`

- [x] **Step 1: Run unit tests**

Run: `pnpm test -- --run`
Expected: pass.

- [x] **Step 2: Run production build**

Run: `pnpm build`
Expected: TypeScript and Vite build pass.

- [x] **Step 3: Browser smoke test**

Run local dev server and verify with browser automation or screenshots that the board is nonblank, 64 gems render, controls exist, and at least one swap resolves.

- [ ] **Step 4: GitHub publishing**

Fix or initialize git metadata, confirm the GitHub remote, install/authenticate `gh` or use another approved GitHub path, then commit and push only intended game files.
