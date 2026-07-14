import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
const scene = readFileSync(new URL("../src/game/match3/Match3Scene.ts", import.meta.url), "utf8");
const gemArt = readFileSync(new URL("../src/game/match3/gemArt.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const manifest = readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8");
const controlAssets = ["hint-button.png", "shuffle-button.png", "pause-button.png", "sound-button.png"];
const interactiveControlAssets = [
  "hint-button-base.png",
  "shuffle-button-base.png",
  "pause-button-base.png",
  "sound-button-base.png",
];

describe("Gem Kingdom UI contract", () => {
  test("renders the approved HUD with one countdown", () => {
    expect(html).toContain('class="top-hud"');
    expect(html).toContain('class="brand-timer-panel"');
    expect(html).toContain('src="/assets/gem-blocks-logo.png"');
    expect(html).toContain('id="ui-target-value"');
    expect(html).toContain('class="gem-legend"');
    expect(html.match(/id="ui-time"/g)).toHaveLength(1);
  });

  test("preserves every existing control action surface", () => {
    expect(html).toContain('id="hint-btn"');
    expect(html).toContain('id="shuffle-btn"');
    expect(html).toContain('id="pause-btn"');
    expect(html).toContain('id="sound-btn"');
    expect(html).toContain('id="hint-label" class="control-label"');
    expect(html).toContain('id="shuffle-label" class="control-label"');
    expect(html).toContain('id="pause-label" class="control-label"');
    expect(html).toContain('id="sound-label" class="control-label"');
    expect(main).toContain("ui.shuffleLabel.textContent");
    expect(main).toContain("ui.soundLabel.textContent");
    expect(main).toContain('ui.hint.addEventListener("click", () => dispatchAction("hint"))');
    expect(main).toContain('ui.shuffle.addEventListener("click", () => dispatchAction("shuffle"))');
    expect(main).toContain('ui.pause.addEventListener("click", () => dispatchAction("pause"))');
    expect(main).toContain('ui.sound.addEventListener("click", () => dispatchAction("sound"))');
  });

  test("updates the pause control label from the current game state", () => {
    expect(main).toContain('pauseLabel: document.querySelector<HTMLSpanElement>("#pause-label")!');
    expect(main).toContain('ui.pauseLabel.textContent = state.state === "paused" ? "繼續" : "暫停";');
  });

  test("uses an iPhone-safe full-screen start menu", () => {
    expect(html).toContain('name="theme-color" content="#7aa82a"');
    expect(css).toContain("--ios-bottom-fill: #7aa82a");
    expect(css).toMatch(/html,\s*body\s*\{[^}]*background-color:\s*var\(--ios-bottom-fill\)/s);
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
    expect(html).toContain('id="overlay" class="overlay" data-mode="menu"');
    expect(html).toContain('id="rules-button"');
    expect(html).toContain('id="rules-panel"');
  });

  test("covers the full iPhone standalone viewport with the game background", () => {
    expect(main).not.toContain('style.setProperty("--app-height"');
    expect(main).not.toContain('visualViewport?.addEventListener("resize"');
    expect(css).toMatch(/html,\s*body\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
    expect(css).toMatch(/\.game-shell\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/s);
    expect(css).not.toMatch(/\.game-shell\s*\{[^}]*height:\s*100dvh/s);
    expect(css).not.toMatch(/\.game-shell\s*\{[^}]*min-height:\s*100dvh/s);
    expect(css).toMatch(/html,\s*body\s*\{[^}]*background-image:\s*url\("\/assets\/gem-kingdom-game-bg\.png"\)/s);
    expect(css).toMatch(/\.game-shell\s*\{[^}]*padding-bottom:\s*0/s);
    expect(css).toMatch(/#game-wrap\s*\{[^}]*flex:\s*0 1 auto/s);
  });

  test("publishes the approved artwork as the browser and iPhone home-screen icon", () => {
    expect(html).not.toContain('rel="manifest"');
    expect(html).toContain('rel="apple-touch-icon" href="/assets/gem-blocks-app-icon.png"');
    expect(html).toContain('rel="icon" type="image/png" href="/assets/gem-blocks-app-icon.png"');
    expect(manifest).toContain('"src": "/assets/gem-blocks-app-icon.png"');
    expect(manifest).toContain('"sizes": "1254x1254"');
  });

  test("keeps the gameplay stage compact on mobile", () => {
    expect(scene).toContain("const HEIGHT = 700;");
    expect(scene).toContain("const BOARD_Y = 41;");
    expect(scene).not.toContain("drawBackground()");
    expect(css).toContain("aspect-ratio: 560 / 700;");
    expect(css).toContain("calc(80dvh - 194px)");
  });

  test("uses the bright fantasy kingdom gameplay theme", () => {
    expect(css).toContain('url("/assets/gem-kingdom-game-bg.png")');
    expect(css).toContain("--hud-blue: #063d78;");
    expect(css).toContain("#hint-btn {");
    expect(css).toContain("#shuffle-btn {");
    expect(css).toContain("#pause-btn {");
    expect(css).toContain("#sound-btn {");
    expect(css).toMatch(/\.control-button\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s);
    expect(css).toMatch(/\.bottom-controls\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s);
    controlAssets.forEach((asset) => {
      expect(existsSync(new URL(`../public/assets/controls/${asset}`, import.meta.url))).toBe(true);
    });
    expect(css).not.toContain("gem-control-buttons-reference.jpg");
    expect(css).toMatch(/\.control-label\s*\{[^}]*position:\s*absolute/s);
  });

  test("anchors four live controls to one stable artwork dock", () => {
    expect(html).toContain('class="bottom-controls controls-dock"');
    expect(css).toContain('url("/assets/controls/control-dock-bg.png")');
    expect(css).toMatch(/\.controls-dock\s*\{[^}]*position:\s*relative/s);
    expect(css).toMatch(/\.controls-dock\s*\{[^}]*width:\s*min\(calc\(100%\s*\+\s*12px\),\s*602px\)/s);
    expect(css).toMatch(/\.controls-dock\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*1/s);
    expect(css).toMatch(/\.controls-dock\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s);
    expect(css).not.toContain(".control-button::before");

    interactiveControlAssets.forEach((asset) => {
      expect(existsSync(new URL(`../public/assets/controls/${asset}`, import.meta.url))).toBe(true);
      expect(css).toContain(`url("/assets/controls/${asset}")`);
    });
  });

  test("shows press feedback without replacing control actions", () => {
    expect(main).toContain('button.addEventListener("pointerdown"');
    expect(main).toContain('button.addEventListener("pointerup"');
    expect(main).toContain('button.addEventListener("pointercancel"');
    expect(main).toContain('button.classList.add("is-pressed")');
    expect(main).toContain('button.classList.remove("is-pressed")');
    expect(css).toMatch(/\.control-button\.is-pressed:not\(:disabled\)[\s\S]*transform:\s*translateY\(3px\) scale\(0\.96\)/);
    expect(css).toMatch(/\.control-button:active:not\(:disabled\),\s*\.control-button\.is-pressed:not\(:disabled\)\s*\{[\s\S]*box-shadow:\s*inset 0 3px 8px rgba\(0, 0, 0, 0\.5\);/);
    expect(main).toContain('ui.shuffle.addEventListener("click", () => dispatchAction("shuffle"))');
  });

  test("darkens sound-off controls while pressed", () => {
    expect(css).toContain("#sound-btn.off:active:not(:disabled),");
    expect(css).toContain("#sound-btn.off.is-pressed:not(:disabled) {");
    expect(css).toContain("filter: brightness(0.78) saturate(0.8) drop-shadow(0 2px 3px rgba(0,45,45,.3));");
  });

  test("connects a real refill preview and transparent special-gem stage", () => {
    expect(scene).toContain('import { GemRefillQueue } from "./refillQueue";');
    expect(scene).toContain("new GemRefillQueue");
    expect(scene).toContain("nextGems: this.refillQueue.preview()");
    expect(scene).toContain("previewRevision: this.refillQueue.revision");
    expect(scene).toContain("ultimateSwapRemoval");
    expect(scene).toContain("transparent: true");
    expect(scene).toContain('this.load.image("gem-atlas"');
    expect(scene).toContain('this.add.image(0, 0, "gem-atlas", frame)');
    expect(html.match(/data-preview-slot=/g)).toHaveLength(6);
    expect(main).toContain("nextGems: number[]");
    expect(main).toContain("previewRevision: number");
    expect(css).toContain('background-image: url("/assets/gems/gem-atlas.png");');
    expect(css).toContain('background-position: 100% 50%;');
    expect(css).toContain("@keyframes preview-gem-drop");
    expect(css).toContain(".gem-legend.is-refilling");
    expect(css).toContain(".control-label");
  });

  test("keeps resolving controls solid and presents special gems as powered jewels", () => {
    expect(css).toMatch(/\.control-button:disabled\s*\{[^}]*opacity:\s*1/s);
    expect(scene).toContain("drawElectricAura");
    expect(scene).toContain("drawElectricCorona");
    expect(scene).toContain("GEM_CHARGE_COLORS");
    expect(scene).toContain("chargedCoreScaleX * 1.06");
    expect(scene).not.toContain("drawElectricPair");
    expect(scene).not.toContain("drawElectricBolt");
    expect(scene).not.toMatch(/targets: chargedCore,[\s\S]{0,120}scale: 1\.06/);
    expect(scene).not.toContain("horizontal ? 66 : 11");
    expect(gemArt).toContain("drawRoyalSetting");
    expect(gemArt).toContain("0xffd45b");
  });

  test("centers selection feedback and keeps the real gem atlas across every level", () => {
    expect(scene).toContain("this.selectionRing = this.add.circle(p.x, p.y");
    expect(scene).toContain("this.tweens.killTweensOf(this.selectionRing)");
    expect(scene).toMatch(/private renderBoard[\s\S]{0,140}this\.clearSelection\(\)/);
    expect(scene).not.toContain("gem.add(ring)");
    expect(scene).toContain('const useAtlas = this.textures.get(GEM_ATLAS_KEY).has(frame);');
    expect(scene).not.toContain('this.tier.key === "classic" &&');
  });

  test("compensates for uneven transparent padding in every atlas gem", () => {
    expect(scene).toContain("const GEM_ATLAS_ORIGINS");
    expect(scene).toContain("gem.setOrigin(atlasOrigin.x, atlasOrigin.y)");
    expect(scene).toContain(".setOrigin(gem.originX, gem.originY)");
  });
});
