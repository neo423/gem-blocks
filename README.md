# 寶石方塊

獨立網頁版寶石方塊消除遊戲。首頁直接進入遊戲，玩家交換相鄰寶石、湊三連以上消除，在倒數時間內達成關卡目標。

## 特色

- 8x8 寶石棋盤
- 點選或拖曳相鄰寶石交換
- 三連消除、落下補洞與連鎖加分
- 4 連生成炸彈寶石，5 連生成行列寶石
- 寫實切面寶石，以程式繪製多層高光、暗邊、切面和閃爍效果
- 等級越高會解鎖新的寶石系列：經典切面、稀有寶石、魔法水晶、星辰寶石
- 提示、洗牌、暫停、本機最佳紀錄
- 桌面與手機響應式版面

## 線上部署

此專案包含 GitHub Pages workflow。推送到 `main` 後，GitHub Actions 會執行測試、建置，並部署 `dist/`。

## 開發

```bash
pnpm install
pnpm dev
```

開啟：

```text
http://127.0.0.1:5173/
```

如果一般 Vite CLI 在 Windows shell 裡不穩，可以使用：

```bash
pnpm dev:stable
```

## 測試與建置

```bash
pnpm test -- --run
pnpm build
```

建置結果會輸出到 `dist/`，可部署到 GitHub Pages 或其他靜態網站服務。
