// Dev-server integration check. Configure Playwright as in check-mobile-layout.cjs.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.PLAYTEST_OUTPUT || 'tmp/game-presentation';

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 792 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch();
      const body = await response.text();
      const probe = `const originalCreate = MATCH3_GAME_CONFIG.scene[0].prototype.create;
        MATCH3_GAME_CONFIG.scene[0].prototype.create = function () { window.__scene = this; return originalCreate.call(this); };\n`;
      await route.fulfill({ response, body: body.replace('new Phaser.Game(', probe + 'new Phaser.Game(') });
    });
    await page.goto(process.env.PLAYTEST_URL || 'http://127.0.0.1:5173/');
    await page.waitForFunction(() => window.__scene?.gems.size === 80);
    await page.locator('#overlay-button').click();
    await page.evaluate(() => {
      window.__scene.totalScore = 9000;
      window.__scene.levelScore = 480;
      window.__scene.updateUi();
    });
    assert.equal(await page.locator('#ui-score').innerText(), '480', 'HUD must show this level, not accumulated score');
    assert.equal(await page.locator('#hud #ui-best').count(), 0);
    assert.ok((await page.locator('.preview-label').innerText()).includes('下一批'));
    assert.equal(await page.locator('[data-preview-slot]').count(), 6);
    await page.screenshot({ path: path.join(output, 'hud.png') });
    await page.locator('#pause-btn').click();
    assert.ok(await page.locator('#overlay-summary').isVisible());
    assert.equal(await page.locator('#summary-total').innerText(), '9000');
    assert.equal(await page.locator('#summary-level-score').innerText(), '480');
    await page.locator('#overlay-button').click();
    // Actual four-run resolution produces the instructional notice.
    await page.evaluate(() => {
      const s = window.__scene;
      s.resetLevel(1, true);
      s.board = Array.from({ length: 10 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + c) % 6));
      s.board[0].fill(0, 0, 4);
      s.renderBoard();
      s.state = 'busy';
      s.resolveBoard(1);
    });
    await page.waitForFunction(() => document.querySelector('#combo-toast').textContent.includes('橫排'));
    await page.screenshot({ path: path.join(output, 'special.png') });
    await page.waitForFunction(() => window.__scene.state === 'playing');
    await page.evaluate(() => {
      const s = window.__scene;
      s.levelScore = Math.ceil(s.target * 0.9);
      s.updateUi();
    });
    assert.ok(await page.locator('#progress-panel').evaluate(e => e.classList.contains('is-near')));
    await page.evaluate(() => {
      const s = window.__scene;
      s.resetLevel(3, true);
      s.levelScore = s.target;
      s.totalScore = 12345;
      s.bestAtLevelStart = 10000;
      s.highestCombo = 4;
      s.completeLevel();
    });
    await page.waitForFunction(() => document.querySelector('#summary-total').textContent === '12345');
    assert.equal(await page.locator('#summary-combo').innerText(), '4 連鎖');
    assert.ok(await page.locator('#new-record').isVisible());
    assert.ok((await page.locator('#overlay-text').innerText()).includes('稀有寶石'));
    await page.screenshot({ path: path.join(output, 'results.png') });
    await page.locator('#overlay-button').click();
    assert.equal(await page.locator('#ui-level').innerText(), '4');
    assert.equal(await page.locator('#ui-score').innerText(), '0');
    // A new overlay cancels any previous count-up; reduced motion settles immediately.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => window.__scene.gameOver());
    assert.equal(await page.locator('#summary-total').innerText(), '12345');
    assert.equal(await page.locator('#new-record').isVisible(), false);
    const button = await page.locator('#overlay-button').boundingBox();
    assert.ok(button.y >= 0 && button.y + button.height <= 568, 'Result action must fit small phones');
    await page.screenshot({ path: path.join(output, 'results-small.png') });
    await page.locator('#overlay-button').click();
    assert.equal(await page.locator('#ui-level').innerText(), '1');
    assert.equal(await page.locator('#ui-score').innerText(), '0');
    assert.deepEqual(errors, []);
    await page.evaluate(() => window.__scene.updateUi({ specialNotice: '橫向閃電誕生！點一下清除整個橫排' }));
    await page.waitForTimeout(100);
    assert.ok(await page.locator('#combo-toast').evaluate(e => Number(getComputedStyle(e).opacity) > 0.9),
      'Reduced-motion users must still be able to read the notice');
    console.log('PASS: HUD, preview, pause totals, special notice, goal state, result animation, unlock, restart and reduced motion.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
