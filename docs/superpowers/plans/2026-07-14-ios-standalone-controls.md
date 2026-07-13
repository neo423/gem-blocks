# iPhone Standalone Background And Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 iPhone 獨立 Web App 的遊戲背景覆蓋完整螢幕，並固定使用核准參考圖的四顆寶石控制按鈕。

**Architecture:** 由 CSS `100dvh` 管理畫面高度，頂部保留 safe-area inset，底部則直接繪製到螢幕邊緣。棋盤容器可在高度不足時縮小，其他 HUD 與控制元件保持固定。按鈕事件不變，外觀改由核准參考圖 sprite 與獨立動態文字層組成。

**Tech Stack:** TypeScript、CSS、Vite、Vitest、Phaser 3

## Global Constraints

- 不修改遊戲邏輯、棋盤資料、消除、計分、關卡、音效與儲存。
- 按鈕唯一視覺基準為核准參考圖。
- 不新增套件。
- 不執行 Git commit 或 push，除非使用者另行明確要求。

---

### Task 1: 建立獨立 Web App 高度與按鈕視覺回歸測試

**Files:**
- Modify: `tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: `src/main.ts` 與 `src/style.css` 純文字內容。
- Produces: 防止 `visualViewport.height` 再次覆寫高度、並鎖定按鈕視覺特徵的 UI contract。

- [ ] **Step 1: Write the failing test**

新增測試，要求 `main.ts` 不包含 `style.setProperty("--app-height"`，並要求 CSS 包含 `min-height: 100dvh`、三層共用背景、四欄控制列、雙層金框、玻璃高光、頂部寶石和大型圖示尺寸。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm.cmd test -- --run tests/ui-contract.test.ts`

Expected: FAIL，因為 `src/main.ts` 仍覆寫 `--app-height`，且完整背景合約尚未建立。

### Task 2: 修正完整高度與背景覆蓋

**Files:**
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Test: `tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: CSS `100dvh` 與既有 safe-area inset。
- Produces: 不依賴 JavaScript viewport 高度的完整 iPhone 獨立 Web App 畫面。

- [ ] **Step 1: Remove the JavaScript viewport override**

刪除 `syncAppHeight()` 及其 `resize`、`visualViewport.resize` 監聽器，不改其他 UI 更新或遊戲事件。

- [ ] **Step 2: Make CSS own the full-screen height**

讓 `.game-shell` 使用 `height: 100dvh; min-height: 100dvh;`，並讓 `html`、`body`、`.game-shell` 共用 `/assets/gem-kingdom-game-bg.png` 的置中 cover 背景。

- [ ] **Step 3: Keep the complete control row inside the viewport**

讓 `#game-wrap` 使用 `flex: 0 1 auto` 吸收高度不足的差額，並取消 `.game-shell` 的底部 safe-area padding，不縮小四顆核准按鈕。

- [ ] **Step 4: Preserve the Apple home-screen launch mode**

移除後來加入的 manifest 連結，保留 `apple-touch-icon`、`apple-mobile-web-app-capable` 與 `viewport-fit=cover`，避免 iPhone 主畫面啟動模式再次改變。

- [ ] **Step 5: Use the approved button artwork directly**

新增核准參考圖素材，四顆按鈕以 sprite 定位顯示原圖外框、寶石與圖示；HTML 增加獨立標籤，讓洗牌次數與音樂狀態仍可更新。

- [ ] **Step 6: Run the focused test**

Run: `pnpm.cmd test -- --run tests/ui-contract.test.ts`

Expected: PASS。

### Task 3: 鎖定參考圖寶石按鈕

**Files:**
- Modify: `src/style.css`
- Test: `tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: 現有 `#hint-btn`、`#shuffle-btn`、`#pause-btn`、`#sound-btn` DOM 與事件。
- Produces: 四顆等寬等高、紫藍綠橘、雙層金框、頂部寶石冠飾、大型金色圖示與白色標籤。

- [ ] **Step 1: Preserve the approved existing button CSS**

現有按鈕已具備核准參考圖的四欄 grid、最小高度、圓角、金框、深色外描邊、玻璃高光、內凹陰影、`::after` 頂部寶石與 `::before` 大型圖示，因此不重畫視覺，只新增 UI contract 防止日後偏離。

- [ ] **Step 2: Preserve interaction states**

確認 disabled 仍為 `opacity: 1`，active/focus 狀態不造成按鈕位置或尺寸跳動。

- [ ] **Step 3: Run the focused test**

Run: `pnpm.cmd test -- --run tests/ui-contract.test.ts`

Expected: PASS。

### Task 4: 完整驗證

**Files:**
- Verify: `src/main.ts`
- Verify: `src/style.css`
- Verify: `tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: 完成的 UI 修改。
- Produces: 測試、建置與瀏覽器視覺證據。

- [ ] **Step 1: Run all tests**

Run: `pnpm.cmd test -- --run`

Expected: 所有測試通過。

- [ ] **Step 2: Run production build**

Run: `pnpm.cmd build`

Expected: TypeScript 與 Vite build 成功。

- [ ] **Step 3: Run rendered QA**

檢查桌面與手機直式：背景延伸到底部、控制列完整、四顆按鈕與參考圖一致、棋盤可操作、console 無相關錯誤。
