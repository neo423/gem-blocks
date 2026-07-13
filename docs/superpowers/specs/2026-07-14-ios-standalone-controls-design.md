# iPhone Standalone Background And Controls Design

## Goal

修正 iPhone 以「加入主畫面」啟動遊戲時，遊戲背景未延伸到螢幕底部、控制按鈕被純藍色系統底色裁切的問題，並將四顆控制按鈕固定為使用者提供參考圖的寶石按鈕形式。

## Locked Reference

按鈕唯一視覺基準為使用者提供的 `codex-clipboard-58883aaf-e7b3-4f73-96c3-60a2449f9236.jpg`。不得改成扁平按鈕、膠囊按鈕或其他近似風格。

## Root Cause

`src/main.ts` 目前以 `window.visualViewport.height` 覆寫 `--app-height`。iPhone 獨立 Web App 模式的 `visualViewport` 可能不包含完整顯示區域，導致 `.game-shell` 提前結束，底部露出 `theme-color` 的純藍色區域。

## Layout

- `.game-shell` 使用 CSS `100dvh` 作為完整高度來源，不再由 JavaScript 覆寫。
- `html`、`body` 與 `.game-shell` 使用同一張遊戲背景，任何安全區都延續背景圖。
- 保留 `viewport-fit=cover` 與 `env(safe-area-inset-top/bottom)`。
- 棋盤維持 8 欄 x 10 列與既有遊戲尺寸邏輯。
- 控制列保持四欄、等寬、完整顯示，不允許被父容器裁切。

## Locked Button Style

- 紫色提示、藍色洗牌、綠色暫停、橘色音樂。
- 方形寶石按鈕比例，四顆等寬等高。
- 雙層金色立體外框、深色外描邊與內凹陰影。
- 上半部玻璃高光，下半部較深。
- 每顆按鈕頂部中央有對應顏色的小寶石冠飾。
- 大型金色功能圖示置中，白色粗體文字置於下方。
- disabled 狀態不得降低整顆按鈕透明度。
- 音樂狀態只切換「音樂 開 / 音樂 關」文字與既有狀態，不更換按鈕造型。

## Scope

- 修改 `src/main.ts`、`src/style.css`、`tests/ui-contract.test.ts`。
- 不修改寶石、棋盤、消除、計分、關卡、音效或儲存邏輯。
- 不新增第三方套件。

## Verification

- UI contract 測試必須確認 JavaScript 不再覆寫 `--app-height`。
- CSS 必須保留 `100dvh`、safe area、完整背景與參考圖按鈕特徵。
- 執行完整 Vitest 與 Vite build。
- 以手機直式與桌面視窗檢查背景、棋盤、控制列與按鈕互動。
