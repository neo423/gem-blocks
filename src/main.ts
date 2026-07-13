import Phaser from "phaser";
import "./style.css";
import { MATCH3_GAME_CONFIG } from "./game/match3/Match3Scene";

type UiState = {
  level: number;
  totalScore: number;
  levelScore: number;
  target: number;
  timeLeft: number;
  shufflesLeft: number;
  tierName: string;
  bestScore: number;
  bestLevel: number;
  progress: number;
  audioEnabled: boolean;
  state: string;
  combo?: number;
  gained?: number;
};

type OverlayState = {
  mode: "menu" | "pause" | "level" | "gameover";
  title: string;
  text: string;
  big?: string;
  button: string;
};

const ui = {
  level: document.querySelector<HTMLSpanElement>("#ui-level")!,
  score: document.querySelector<HTMLSpanElement>("#ui-score")!,
  targetValue: document.querySelector<HTMLSpanElement>("#ui-target-value")!,
  target: document.querySelector<HTMLSpanElement>("#ui-target")!,
  time: document.querySelector<HTMLSpanElement>("#ui-time")!,
  tier: document.querySelector<HTMLSpanElement>("#ui-tier")!,
  best: document.querySelector<HTMLSpanElement>("#ui-best")!,
  progress: document.querySelector<HTMLDivElement>("#ui-progress")!,
  combo: document.querySelector<HTMLDivElement>("#combo-toast")!,
  hint: document.querySelector<HTMLButtonElement>("#hint-btn")!,
  shuffle: document.querySelector<HTMLButtonElement>("#shuffle-btn")!,
  pause: document.querySelector<HTMLButtonElement>("#pause-btn")!,
  sound: document.querySelector<HTMLButtonElement>("#sound-btn")!,
  overlay: document.querySelector<HTMLDivElement>("#overlay")!,
  overlayTitle: document.querySelector<HTMLHeadingElement>("#overlay-title")!,
  overlayText: document.querySelector<HTMLParagraphElement>("#overlay-text")!,
  overlayBig: document.querySelector<HTMLDivElement>("#overlay-big")!,
  overlayButton: document.querySelector<HTMLButtonElement>("#overlay-button")!,
  rulesButton: document.querySelector<HTMLButtonElement>("#rules-button")!,
  rulesPanel: document.querySelector<HTMLElement>("#rules-panel")!,
  rulesClose: document.querySelector<HTMLButtonElement>("#rules-close")!
};

let overlayMode: OverlayState["mode"] = "menu";

function syncAppHeight() {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${Math.round(viewportHeight)}px`);
}

syncAppHeight();
window.addEventListener("resize", syncAppHeight);
window.visualViewport?.addEventListener("resize", syncAppHeight);

new Phaser.Game(MATCH3_GAME_CONFIG);

window.addEventListener("gem-ui", (event) => {
  updateUi((event as CustomEvent<UiState>).detail);
});

window.addEventListener("gem-overlay", (event) => {
  showOverlay((event as CustomEvent<OverlayState>).detail);
});

window.addEventListener("gem-overlay-hide", () => {
  ui.overlay.classList.add("hidden");
});

ui.hint.addEventListener("click", () => dispatchAction("hint"));
ui.shuffle.addEventListener("click", () => dispatchAction("shuffle"));
ui.pause.addEventListener("click", () => dispatchAction("pause"));
ui.sound.addEventListener("click", () => dispatchAction("sound"));
ui.rulesButton.addEventListener("click", () => {
  ui.rulesPanel.classList.remove("hidden");
  ui.rulesClose.focus();
});
ui.rulesClose.addEventListener("click", closeRules);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !ui.rulesPanel.classList.contains("hidden")) closeRules();
});
ui.overlayButton.addEventListener("click", () => {
  if (overlayMode === "menu") {
    dispatchAction("start");
    return;
  }
  if (overlayMode === "pause") {
    dispatchAction("resume");
    return;
  }
  if (overlayMode === "level") {
    dispatchAction("next");
    return;
  }
  dispatchAction("restart");
});

function dispatchAction(action: string) {
  window.dispatchEvent(new CustomEvent("gem-action", { detail: action }));
}

function updateUi(state: UiState) {
  ui.level.textContent = String(state.level);
  ui.score.textContent = String(state.totalScore);
  ui.targetValue.textContent = String(state.target);
  ui.target.textContent = `${state.levelScore} / ${state.target}`;
  ui.time.textContent = formatTime(state.timeLeft);
  ui.time.classList.toggle("low", state.timeLeft <= 15 && state.state === "playing");
  ui.tier.textContent = state.tierName;
  ui.best.textContent = `${state.bestScore} / Lv.${state.bestLevel}`;
  ui.progress.style.width = `${Math.round(state.progress * 100)}%`;
  ui.shuffle.textContent = `洗牌 x${state.shufflesLeft}`;
  ui.shuffle.disabled = state.shufflesLeft <= 0 || state.state !== "playing";
  ui.hint.disabled = state.state !== "playing";
  ui.pause.disabled = state.state !== "playing";
  ui.sound.textContent = state.audioEnabled ? "音樂 開" : "音樂 關";
  ui.sound.classList.toggle("off", !state.audioEnabled);
  ui.sound.setAttribute("aria-pressed", String(state.audioEnabled));

  if (state.gained) {
    ui.combo.textContent = state.combo && state.combo > 1 ? `連鎖 x${state.combo}  +${state.gained}` : `+${state.gained}`;
    ui.combo.classList.remove("show");
    requestAnimationFrame(() => ui.combo.classList.add("show"));
  }
}

function showOverlay(state: OverlayState) {
  overlayMode = state.mode;
  ui.rulesPanel.classList.add("hidden");
  ui.overlay.dataset.mode = state.mode;
  ui.overlayTitle.textContent = state.title;
  ui.overlayText.textContent = state.text;
  ui.overlayBig.textContent = state.big ?? "";
  ui.overlayBig.classList.toggle("hidden", !state.big);
  ui.overlayButton.textContent = state.mode === "menu" ? "開始遊戲" : state.button;
  ui.overlay.classList.remove("hidden");
}

function closeRules() {
  ui.rulesPanel.classList.add("hidden");
  ui.rulesButton.focus();
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = String(safe % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}
