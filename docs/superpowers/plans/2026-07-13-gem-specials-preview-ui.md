# Gem Specials, Real Preview Queue, and Mobile UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add directional four-match gems, five-match ultimate color-clearing gems, an actual refill preview queue, higher-quality gem art, and a transparent mobile stage without changing the 8 x 10 board or level timing.

**Architecture:** Keep match detection and special expansion as pure functions in `logic.ts`, with special kinds represented in `types.ts` and `balance.ts`. A small deterministic `GemRefillQueue` owns future refill values and is consumed by the existing gravity spawn callback. `Match3Scene` coordinates special swaps, queue state, rendering, and effects; `main.ts` and `style.css` render the six-value preview and mobile controls.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest, DOM/CSS HUD.

## Global Constraints

- Preserve `BOARD_ROWS = 10`, `BOARD_COLS = 8`, and `BASE_LEVEL_TIME_SECONDS = 150`.
- Do not change target growth, save key, audio ownership, or level skin progression.
- Stage only files from this feature if a later publish is explicitly requested.
- Do not commit or push during implementation without separate approval.
- Respect `prefers-reduced-motion` and iPhone safe areas.

---

### Task 1: Special-match pure logic

**Files:**
- Modify: `src/game/match3/types.ts`
- Modify: `src/game/match3/balance.ts`
- Modify: `src/game/match3/logic.ts`
- Test: `src/game/match3/logic.test.ts`

**Interfaces:**
- Produces `SPECIAL_ROW`, `SPECIAL_COLUMN`, and `SPECIAL_ULTIMATE`.
- Produces `ultimateSwapRemoval(board, specials, a, b): Set<number> | null`.
- `planMatches` maps four-horizontal to row, four-vertical to column, and five-plus to ultimate.

- [ ] Write failing tests asserting four-horizontal/vertical creation kinds, five-match ultimate creation, directional line expansion, target-color ultimate clearing, double-ultimate board clearing, and chain triggering.
- [ ] Run `.\node_modules\.bin\vitest.cmd --run src/game/match3/logic.test.ts` and verify the new assertions fail for missing constants/behavior.
- [ ] Extend special types/constants and implement the minimal pure logic.
- [ ] Run the focused test again and verify all logic tests pass.
- [ ] Run the full Vitest suite to catch match/hint/gravity regressions.

### Task 2: Deterministic refill preview queue

**Files:**
- Create: `src/game/match3/refillQueue.ts`
- Create: `src/game/match3/refillQueue.test.ts`

**Interfaces:**
- Produces `GemRefillQueue` with `next(): GemValue`, `preview(count?: number): GemValue[]`, and `revision: number`.
- Constructor accepts `random: () => number` and `previewSize = 6`.

- [ ] Write failing tests proving initial preview order, FIFO consumption, immediate replenishment, six-color bounds, and revision increments.
- [ ] Run the focused queue test and verify failure because the module is absent.
- [ ] Implement the minimal queue with only normal gem values `0..5`.
- [ ] Run the queue test and verify it passes.

### Task 3: Scene integration and effects

**Files:**
- Modify: `src/game/match3/Match3Scene.ts`
- Modify: `src/game/match3/gemArt.ts`
- Test: `tests/ui-contract.test.ts`

**Interfaces:**
- `Match3Scene.updateUi` includes `nextGems` and `previewRevision`.
- Gravity consumes `refillQueue.next` through `applyGravityWithPlan`.
- Ultimate swaps bypass ordinary three-match validation and resolve the returned removal set.

- [ ] Add UI contract assertions for transparent Phaser config, queue fields, and special texture hooks; run and verify they fail.
- [ ] Initialize/reset `GemRefillQueue`, expose its preview in UI events, and consume it only for gravity spawns.
- [ ] Detect ultimate swaps before ordinary match validation; score, animate, clear, and settle the returned set.
- [ ] Render row/column lightning overlays and a distinct ultimate diamond; add color-matched lightning particles without changing gem hit areas.
- [ ] Remove the full-canvas blue background/footer and configure Phaser transparency while retaining the board frame.
- [ ] Run focused and full tests.

### Task 4: Live preview HUD and jewel controls

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Test: `tests/ui-contract.test.ts`

**Interfaces:**
- Six `.legend-gem` elements receive `data-gem` values `0..5`.
- `main.ts` restarts `.is-refilling` only when `previewRevision` changes.

- [ ] Add failing UI contract assertions for six preview slots, `data-gem` styling, drop animation, transparent stage, and jewel button caps.
- [ ] Update the DOM bridge to map `nextGems` to the preview slots and restart a staggered refill animation.
- [ ] Replace static legend color classes with `data-gem` visuals, idle shimmer, and refill drop/bounce motion.
- [ ] Make the four controls near-square with thick gold bevels, color-coded crystal faces, top gem caps, and short-viewport dimensions that remain above the browser URL bar.
- [ ] Ensure `prefers-reduced-motion` disables nonessential preview/button animation.

### Task 5: High-quality gem asset pass and verification

**Files:**
- Create or modify only approved files under: `public/assets/gems/`
- Modify: `src/game/match3/gemArt.ts`

**Interfaces:**
- Normal gems retain the current six color indices and hit boxes.
- Procedural textures remain the runtime fallback when a raster asset is unavailable.

- [ ] Generate transparent, text-free gem art based on the supplied cut-crystal reference, with six normal colors plus directional and ultimate visual treatments.
- [ ] Inspect every generated asset for transparent edges, readable silhouettes at mobile cell size, consistent lighting, and no labels/background remnants.
- [ ] Integrate accepted assets without changing board data values or input geometry.
- [ ] Run `.\node_modules\.bin\vitest.cmd --run`, `.\node_modules\.bin\tsc.cmd --noEmit`, and `.\node_modules\.bin\vite.cmd build`.
- [ ] Browser-test 393 x 698 and 393 x 852 for no scrolling, no blue canvas overflow, aligned controls, animated real preview order, pause/resume, four-match direction, and ultimate color clearing.
- [ ] Review `git diff --check` and verify unrelated working-tree files remain unstaged and unchanged by this feature.
