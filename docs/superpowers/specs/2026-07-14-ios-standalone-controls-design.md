# iPhone Standalone Background And Controls Design

## Goal

修正 iPhone 以「加入主畫面」啟動遊戲時，遊戲背景未延伸到螢幕底部、控制按鈕被純藍色系統底色裁切的問題，並將四顆控制按鈕固定為使用者提供參考圖的寶石按鈕形式。

## Locked Reference

按鈕唯一視覺基準為使用者提供的 `codex-clipboard-58883aaf-e7b3-4f73-96c3-60a2449f9236.jpg`。不得改成扁平按鈕、膠囊按鈕或其他近似風格。

## Root Cause

第一階段已移除 `window.visualViewport.height` 對 `--app-height` 的覆寫，第二階段也把底部 safe-area padding 設為零；但實機截圖證明 `100dvh` 在部分 iPhone 獨立 Web App 模式仍會停在底部安全區上方。結果是 `.game-shell` 提早結束、控制列被 `overflow: hidden` 裁切，並露出外層頁面的藍色背景。根因不是按鈕高度，而是遊戲根容器仍以 viewport unit 決定高度。

## Layout

- `.game-shell` 使用 `position: fixed; inset: 0;` 貼齊可繪製視窗四邊，不再以 `100dvh` 決定根容器高度。
- `html`、`body` 與 `.game-shell` 使用同一張遊戲背景，任何安全區都延續背景圖。
- iPhone 主畫面圖示使用 `apple-touch-icon`，不連結會改變既有顯示模式的 manifest。
- 保留 `viewport-fit=cover`，但 `.game-shell` 不再加入底部 safe-area padding，背景直接畫到螢幕底部。
- 棋盤維持 8 欄 x 10 列與既有遊戲尺寸邏輯。
- `#game-wrap` 可在高度不足時縮小，HUD、預覽列與控制按鈕維持原尺寸。
- 控制列保持四欄、等寬、完整顯示，不允許被父容器裁切。

## Locked Button Style

- 直接使用核准參考圖 `gem-control-buttons-reference.jpg` 中的紫色提示、藍色洗牌、綠色暫停、橘色音樂按鈕。
- 方形寶石按鈕比例，四顆等寬等高。
- 雙層金色立體外框、深色外描邊與內凹陰影。
- 上半部玻璃高光，下半部較深。
- 每顆按鈕頂部中央有對應顏色的小寶石冠飾。
- 外框、頂部寶石與大型金色功能圖示直接取自原圖；白色動態文字以獨立標籤置於下方。
- disabled 狀態不得降低整顆按鈕透明度。
- 音樂狀態只切換「音樂 開 / 音樂 關」文字與既有狀態，不更換按鈕造型。

## Scope

- 修改 `index.html`、`src/main.ts`、`src/style.css`、`tests/ui-contract.test.ts`，新增核准按鈕參考素材。
- 不修改寶石、棋盤、消除、計分、關卡、音效或儲存邏輯。
- 不新增第三方套件。

## Verification

- UI contract 測試必須確認 JavaScript 不再覆寫 `--app-height`。
- CSS 必須保留固定四邊根容器、可縮小棋盤、零底部 safe-area padding、完整背景與原圖按鈕 sprite。
- 執行完整 Vitest 與 Vite build。
- 以手機直式與桌面視窗檢查背景、棋盤、控制列與按鈕互動。
