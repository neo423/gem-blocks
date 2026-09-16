import Phaser from "phaser";
import "./style.css";
import { MATCH3_GAME_CONFIG } from "./game/match3/Match3Scene";
import type { OverlayState } from "./game/match3/types";

type UiState = {
  level: number;
  totalScore: number;
  levelScore: number;
  target: number;
  timeLeft: number;
  shufflesLeft: number;
  tierName: string;
  previewImages: string[];
  bestScore: number;
  bestLevel: number;
  progress: number;
  audioEnabled: boolean;
  state: string;
  nextGems: number[];
  previewRevision: number;
  combo?: number;
  gained?: number;
  specialNotice?: string;
};

const ui = {
  level: document.querySelector<HTMLSpanElement>("#ui-level")!,
  score: document.querySelector<HTMLSpanElement>("#ui-score")!,
  targetValue: document.querySelector<HTMLSpanElement>("#ui-target-value")!,
  time: document.querySelector<HTMLSpanElement>("#ui-time")!,
  tier: document.querySelector<HTMLSpanElement>("#ui-tier")!,
  best: document.querySelector<HTMLSpanElement>("#ui-best")!,
  progress: document.querySelector<HTMLDivElement>("#ui-progress")!,
  progressPanel: document.querySelector<HTMLElement>("#progress-panel")!,
  progressTrack: document.querySelector<HTMLElement>(".progress-track")!,
  legend: document.querySelector<HTMLElement>(".gem-legend")!,
  previewSlots: [...document.querySelectorAll<HTMLElement>("[data-preview-slot]")],
  combo: document.querySelector<HTMLDivElement>("#combo-toast")!,
  hint: document.querySelector<HTMLButtonElement>("#hint-btn")!,
  shuffle: document.querySelector<HTMLButtonElement>("#shuffle-btn")!,
  shuffleLabel: document.querySelector<HTMLSpanElement>("#shuffle-label")!,
  pause: document.querySelector<HTMLButtonElement>("#pause-btn")!,
  pauseLabel: document.querySelector<HTMLSpanElement>("#pause-label")!,
  sound: document.querySelector<HTMLButtonElement>("#sound-btn")!,
  soundLabel: document.querySelector<HTMLSpanElement>("#sound-label")!,
  overlay: document.querySelector<HTMLDivElement>("#overlay")!,
  overlayTitle: document.querySelector<HTMLHeadingElement>("#overlay-title")!,
  overlayText: document.querySelector<HTMLParagraphElement>("#overlay-text")!,
  overlayBig: document.querySelector<HTMLDivElement>("#overlay-big")!,
  summary: document.querySelector<HTMLElement>("#overlay-summary")!,
  summaryTotal: document.querySelector<HTMLElement>("#summary-total")!,
  summaryLevelScore: document.querySelector<HTMLElement>("#summary-level-score")!,
  summaryCombo: document.querySelector<HTMLElement>("#summary-combo")!,
  newRecord: document.querySelector<HTMLElement>("#new-record")!,
  overlayButton: document.querySelector<HTMLButtonElement>("#overlay-button")!,
  rulesButton: document.querySelector<HTMLButtonElement>("#rules-button")!,
  rulesPanel: document.querySelector<HTMLElement>("#rules-panel")!,
  rulesClose: document.querySelector<HTMLButtonElement>("#rules-close")!
};

let overlayMode: OverlayState["mode"] = "menu";
let renderedPreviewRevision = -1;
let scoreFrame = 0;
let toastTimer = 0;
let specialNoticeActive = false;

new Phaser.Game(MATCH3_GAME_CONFIG);

window.addEventListener("gem-ui", (event) => {
  updateUi((event as CustomEvent<UiState>).detail);
});

window.addEventListener("gem-overlay", (event) => {
  showOverlay((event as CustomEvent<OverlayState>).detail);
});

window.addEventListener("gem-overlay-hide", () => {
  cancelAnimationFrame(scoreFrame);
  ui.overlay.classList.add("hidden");
  clearToast();
});

function bindPressFeedback(button: HTMLButtonElement): void {
  const release = () => button.classList.remove("is-pressed");

  button.addEventListener("pointerdown", () => {
    if (!button.disabled) button.classList.add("is-pressed");
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
}

[ui.hint, ui.shuffle, ui.pause, ui.sound].forEach(bindPressFeedback);

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
  ui.score.textContent = String(state.levelScore);
  ui.targetValue.textContent = String(state.target);
  ui.time.textContent = formatTime(state.timeLeft);
  ui.time.classList.toggle("low", state.timeLeft <= 15 && state.state === "playing");
  ui.tier.textContent = state.tierName;
  ui.best.textContent = `${state.bestScore} / Lv.${state.bestLevel}`;
  ui.progress.style.width = `${Math.round(state.progress * 100)}%`;
  ui.progressTrack.setAttribute("aria-valuemax", String(state.target));
  ui.progressTrack.setAttribute("aria-valuenow", String(Math.min(state.levelScore, state.target)));
  ui.progressTrack.setAttribute("aria-valuetext", `${state.levelScore} / ${state.target}`);
  ui.progressPanel.classList.toggle("is-near", state.progress >= 0.85 && state.progress < 1);
  ui.progressPanel.classList.toggle("is-complete", state.progress >= 1);
  ui.shuffleLabel.textContent = `洗牌 x${state.shufflesLeft}`;
  ui.shuffle.disabled = state.shufflesLeft <= 0 || state.state !== "playing";
  ui.hint.disabled = state.state !== "playing";
  ui.pause.disabled = state.state !== "playing";
  ui.pauseLabel.textContent = state.state === "paused" ? "繼續" : "暫停";
  ui.soundLabel.textContent = state.audioEnabled ? "音樂 開" : "音樂 關";
  ui.sound.classList.toggle("off", !state.audioEnabled);
  ui.sound.setAttribute("aria-pressed", String(state.audioEnabled));

  state.nextGems.forEach((gem, index) => {
    const slot = ui.previewSlots[index];
    if (slot) {
      slot.dataset.gem = String(gem);
      const previewImage = state.previewImages[gem];
      slot.classList.toggle("is-tier-gem", Boolean(previewImage));
      slot.style.backgroundImage = previewImage ? `url("${previewImage}")` : "";
    }
  });
  if (state.previewRevision !== renderedPreviewRevision) {
    renderedPreviewRevision = state.previewRevision;
    ui.legend.classList.remove("is-refilling");
    void ui.legend.offsetWidth;
    ui.legend.classList.add("is-refilling");
    window.setTimeout(() => {
      if (renderedPreviewRevision === state.previewRevision) ui.legend.classList.remove("is-refilling");
    }, 760);
  }

  if (state.specialNotice) {
    showToast(state.specialNotice, "special", 1900);
  } else if (state.gained && !specialNoticeActive) {
    const chained = state.combo && state.combo > 1;
    showToast(chained ? `連鎖 ×${state.combo}  +${state.gained}` : `+${state.gained}`,
      chained ? "combo" : "score", chained ? 1000 : 650);
  }
}

function clearToast() {
  window.clearTimeout(toastTimer);
  specialNoticeActive = false;
  ui.combo.classList.remove("show");
  ui.combo.textContent = "";
}

function showToast(text: string, kind: "special" | "combo" | "score", duration: number) {
  clearToast();
  specialNoticeActive = kind === "special";
  ui.combo.textContent = text;
  ui.combo.dataset.kind = kind;
  ui.combo.style.setProperty("--toast-duration", `${duration}ms`);
  void ui.combo.offsetWidth;
  ui.combo.classList.add("show");
  toastTimer = window.setTimeout(clearToast, duration);
}

function showOverlay(state: OverlayState) {
  cancelAnimationFrame(scoreFrame);
  clearToast();
  overlayMode = state.mode;
  ui.rulesPanel.classList.add("hidden");
  ui.overlay.dataset.mode = state.mode;
  ui.overlayTitle.textContent = state.title;
  ui.overlayText.textContent = state.text;
  ui.overlayBig.textContent = state.big ?? "";
  ui.overlayBig.classList.toggle("hidden", !state.big || Boolean(state.summary));
  ui.summary.classList.toggle("hidden", !state.summary);
  if (state.summary) {
    const { totalScore, levelScore, highestCombo, bestScore, bestLevel, newBest } = state.summary;
    ui.summaryLevelScore.textContent = String(levelScore);
    ui.summaryCombo.textContent = highestCombo > 0 ? `${highestCombo} 連鎖` : "—";
    ui.best.textContent = `${bestScore} / Lv.${bestLevel}`;
    ui.newRecord.classList.toggle("hidden", !newBest || state.mode === "pause");
    animateTotal(totalScore, state.mode !== "pause");
  }
  ui.overlayButton.textContent = state.mode === "menu" ? "開始遊戲" : state.button;
  ui.overlay.classList.remove("hidden");
}

function animateTotal(total: number, animate: boolean) {
  ui.summaryTotal.setAttribute("aria-label", `${total} 分`);
  if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    ui.summaryTotal.textContent = String(total);
    return;
  }
  const start = performance.now();
  ui.summaryTotal.textContent = "0";
  const tick = (now: number) => {
    const progress = Math.min(1, (now - start) / 650);
    ui.summaryTotal.textContent = String(Math.round(total * (1 - (1 - progress) ** 3)));
    if (progress < 1) scoreFrame = requestAnimationFrame(tick);
  };
  scoreFrame = requestAnimationFrame(tick);
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
