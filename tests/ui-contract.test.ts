import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("Royal Vault UI contract", () => {
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
    expect(html).toContain('name="theme-color" content="#06131a"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
    expect(html).toContain('id="overlay" class="overlay" data-mode="menu"');
    expect(html).toContain('id="rules-button"');
    expect(html).toContain('id="rules-panel"');
  });
});
