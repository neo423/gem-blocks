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
  targetCard: document.querySelector<HTMLSpanElement>("#ui-target-card")!,
  target: document.querySelector<HTMLSpanElement>("#ui-target")!,
  time: document.querySelector<HTMLDivElement>("#ui-time")!,
  tier: document.querySelector<HTMLSpanElement>("#ui-tier")!,
  best: document.querySelector<HTMLSpanElement>("#ui-best")!,
  progress: document.querySelector<HTMLDivElement>("#ui-progress")!,
  combo: document.querySelector<HTMLDivElement>("#combo-toast")!,
  hint: document.querySelector<HTMLButtonElement>("#hint-btn")!,
  shuffle: document.querySelector<HTMLButtonElement>("#shuffle-btn")!,
  shuffleCount: document.querySelector<HTMLSpanElement>("#ui-shuffle-count")!,
  pause: document.querySelector<HTMLButtonElement>("#pause-btn")!,
  sound: document.querySelector<HTMLButtonElement>("#sound-btn")!,
  soundIcon: document.querySelector<HTMLSpanElement>("#ui-sound-icon")!,
  overlay: document.querySelector<HTMLDivElement>("#overlay")!,
  overlayTitle: document.querySelector<HTMLHeadingElement>("#overlay-title")!,
  overlayText: document.querySelector<HTMLParagraphElement>("#overlay-text")!,
  overlayBig: document.querySelector<HTMLDivElement>("#overlay-big")!,
  overlayButton: document.querySelector<HTMLButtonElement>("#overlay-button")!
};

let overlayMode: OverlayState["mode"] = "menu";

let viewportFrame = 0;

function syncViewportHeight() {
  viewportFrame = 0;
  const height = Math.max(320, Math.round(window.visualViewport?.height ?? window.innerHeight));
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

function scheduleViewportSync() {
  if (viewportFrame) {
    cancelAnimationFrame(viewportFrame);
  }
  viewportFrame = requestAnimationFrame(syncViewportHeight);
}

syncViewportHeight();
window.addEventListener("resize", scheduleViewportSync);
window.addEventListener("orientationchange", scheduleViewportSync);
window.visualViewport?.addEventListener("resize", scheduleViewportSync);
window.visualViewport?.addEventListener("scroll", scheduleViewportSync);

new Phaser.Game(MATCH3_GAME_CONFIG);

window.addEventListener("gem-ui", (event) => {
  renderUi((event as CustomEvent<UiState>).detail);
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

function renderUi(state: UiState) {
  const formattedTime = formatTime(state.timeLeft);

  ui.level.textContent = String(state.level);
  ui.score.textContent = String(state.totalScore);
  ui.targetCard.textContent = String(state.target);
  ui.target.textContent = `${state.levelScore} / ${state.target}`;
  ui.time.textContent = formattedTime;
  ui.time.classList.toggle("low", state.timeLeft <= 15 && state.state === "playing");
  ui.tier.textContent = state.tierName;
  ui.best.textContent = `${state.bestScore} / Lv.${state.bestLevel}`;
  ui.progress.style.width = `${Math.round(state.progress * 100)}%`;
  ui.shuffleCount.textContent = `x${state.shufflesLeft}`;
  ui.shuffle.setAttribute("aria-label", `洗牌，剩餘 ${state.shufflesLeft} 次`);
  ui.shuffle.setAttribute("title", `洗牌，剩餘 ${state.shufflesLeft} 次`);
  ui.shuffle.disabled = state.shufflesLeft <= 0 || state.state !== "playing";
  ui.hint.disabled = state.state !== "playing";
  ui.pause.disabled = state.state !== "playing";
  ui.soundIcon.textContent = "♪";
  ui.sound.setAttribute("aria-label", state.audioEnabled ? "音樂開啟" : "音樂關閉");
  ui.sound.setAttribute("title", state.audioEnabled ? "音樂開啟" : "音樂關閉");
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
  ui.overlayTitle.textContent = state.title;
  ui.overlayText.textContent = state.text;
  ui.overlayBig.textContent = state.big ?? "";
  ui.overlayBig.classList.toggle("hidden", !state.big);
  ui.overlayButton.textContent = state.button;
  ui.overlay.classList.remove("hidden");
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = String(safe % 60).padStart(2, "0");
  return `${String(minutes).padStart(2, "0")}:${rest}`;
}
