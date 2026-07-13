# 寶石方塊 Gem Blocks

<p align="center">
  <img src="public/assets/gem-blocks-logo.png" alt="寶石方塊遊戲 Logo" width="460">
</p>

<p align="center">
  一款為手機直式畫面打造的網頁寶石消除遊戲。交換相鄰寶石、製造連鎖消除，並在倒數時間內完成每一關的分數目標。
</p>

<p align="center">
  <a href="https://gem-blocks.pages.dev/"><strong>立即線上遊玩</strong></a>
  ·
  <a href="#遊戲玩法">遊戲玩法</a>
  ·
  <a href="#本機開發">本機開發</a>
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/Code%20License-MIT-d6b25e">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178c6">
  <img alt="Phaser" src="https://img.shields.io/badge/Phaser-3.90-8b5cf6">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-7-646cff">
</p>

## 遊戲畫面

<p align="center">
  <a href="https://gem-blocks.pages.dev/">
    <img src="public/assets/gem-blocks-start-screen.png" alt="寶石方塊手機版開始畫面" width="360">
  </a>
</p>

## 遊戲特色

- 手機優先的直式遊戲介面，也支援桌面瀏覽器。
- 直向 10 格、橫向 8 格的寶石棋盤。
- 支援點選交換與滑動相鄰寶石。
- 三連以上完整消除、重力掉落、連鎖反應與連鎖加分。
- 真實寶石掉落預覽，預覽順序會對應下一批進場寶石。
- 4 顆連線可進化成橫向或直向閃電寶石。
- 5 顆以上連線可進化成終極寶石。
- 終極寶石與任一顏色交換，可消除棋盤上所有同色寶石。
- 具備寶石碎裂、閃電、粒子、掉落與碰撞動畫。
- 內建背景音樂及選取、交換、消除、洗牌與關卡音效。
- 關卡提升後依序解鎖經典切面、稀有寶石、魔法水晶與星辰寶石。
- 提示、每關 3 次洗牌、暫停、音樂開關與本機最佳紀錄。

## 遊戲玩法

1. 點選兩顆相鄰寶石，或在寶石上向相鄰方向滑動。
2. 排成橫向或直向 3 顆以上相同寶石即可消除。
3. 在倒數時間結束前達成該關目標分數。
4. 完成關卡後繼續挑戰更高目標與新的寶石系列。

### 特殊寶石

| 連線方式 | 產生效果 |
| --- | --- |
| 3 顆 | 消除相連寶石 |
| 橫向 4 顆 | 產生橫向閃電寶石，可清除所在橫排 |
| 直向 4 顆 | 產生直向閃電寶石，可清除所在直排 |
| 5 顆以上 | 產生終極寶石，可清除指定顏色 |
| 兩顆終極寶石交換 | 清除整個棋盤 |

特殊寶石能觸發其他特殊寶石，形成連鎖清除效果。

## 手機遊玩

直接使用手機瀏覽器開啟：

**https://gem-blocks.pages.dev/**

遊戲已針對 iPhone 與 Android 直式畫面調整，並包含安全區域及瀏覽器底部工具列預留空間。支援 PWA 的瀏覽器也可將網站加入主畫面，以接近獨立 App 的方式啟動。

## 技術組成

- [Phaser 3](https://phaser.io/)：棋盤、寶石、輸入與動畫。
- [TypeScript](https://www.typescriptlang.org/)：遊戲邏輯與型別安全。
- [Vite](https://vite.dev/)：本機開發與正式版建置。
- [Vitest](https://vitest.dev/)：消除規則、特殊寶石、音效與 UI 合約測試。
- Web Audio API：即時背景音樂與遊戲音效。
- Local Storage：保存最佳分數、最高關卡與音樂偏好。

## 本機開發

### 環境需求

- Node.js 22.13 或更新版本
- pnpm 11.7.0

### 安裝與啟動

```bash
pnpm install
pnpm dev
```

開啟：

```text
http://127.0.0.1:5173/
```

若要讓同一個區域網路內的手機連線測試：

```bash
pnpm dev:mobile
```

Windows 環境若一般 Vite 啟動不穩定，也可使用：

```bash
pnpm dev:stable
pnpm dev:mobile:stable
```

## 測試與建置

```bash
pnpm test -- --run
pnpm build
```

正式建置結果會輸出至 `dist/`。

## 專案結構

```text
gem-blocks/
├─ public/                   # Logo、背景、寶石圖集與 PWA 設定
├─ src/
│  ├─ game/match3/          # 棋盤、消除規則、特效、音效與測試
│  ├─ main.ts               # HUD 與遊戲介面狀態同步
│  └─ style.css             # 手機優先的遊戲介面樣式
├─ tests/                    # UI 結構與合約測試
├─ index.html                # 遊戲頁面結構
└─ vite.config.ts            # Vite 與測試設定
```

## 部署

正式版本透過 Cloudflare Pages 發布。更新 `main` 分支後，Cloudflare 會自動建置並部署最新版本。

專案也保留 `.github/workflows/deploy-pages.yml`，可在 GitHub Actions 手動執行測試、建置及 GitHub Pages 部署。

## 授權

本專案的**原始程式碼**採用 [MIT License](LICENSE) 授權：你可以使用、修改、散布及商業使用程式碼，但必須保留原授權與版權聲明。

遊戲名稱、Logo、寶石圖集、背景及其他視覺美術資產不包含在 MIT 授權範圍內，詳細規範請參閱 [ASSET_LICENSE.md](ASSET_LICENSE.md)。

Copyright (c) 2026 neo423
