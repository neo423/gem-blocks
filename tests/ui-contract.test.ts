import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
const scene = readFileSync(new URL("../src/game/match3/Match3Scene.ts", import.meta.url), "utf8");

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
  });

  test("uses an iPhone-safe full-screen start menu", () => {
    expect(html).toContain('name="theme-color" content="#159ed9"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
    expect(html).toContain('id="overlay" class="overlay" data-mode="menu"');
    expect(html).toContain('id="rules-button"');
    expect(html).toContain('id="rules-panel"');
  });

  test("keeps the gameplay stage compact on mobile", () => {
    expect(scene).toContain("const HEIGHT = 700;");
    expect(scene).toContain("const STAGE_FOOTER_HEIGHT = 29;");
    expect(scene).toContain("const BOARD_Y = 41;");
    expect(css).toContain("transform: translateY(2px);");
  });

  test("uses the bright fantasy kingdom gameplay theme", () => {
    expect(css).toContain('url("/assets/gem-kingdom-game-bg.png")');
    expect(css).toContain("--hud-blue: #063d78;");
    expect(css).toContain("#hint-btn {");
    expect(css).toContain("#shuffle-btn {");
    expect(css).toContain("#pause-btn {");
    expect(css).toContain("#sound-btn {");
  });
});
