// Run against the dev server. Set PLAYWRIGHT_MODULE if Playwright is installed externally.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const output = process.env.PLAYTEST_OUTPUT || 'tmp/mobile-layout';
const baseline = process.argv.includes('--baseline');
const cases = [
  { name: 'phone-reference', width: 393, height: 792, top: 59, bottom: 0 },
  { name: 'phone-safe-area', width: 393, height: 852, top: 59, bottom: 34 },
  { name: 'small-phone', width: 320, height: 568, top: 0, bottom: 0 },
  { name: 'large-phone', width: 430, height: 932, top: 59, bottom: 34 },
  { name: 'desktop', width: 1440, height: 900, top: 0, bottom: 0 }
];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  const errors = [];
  const results = [];
  try {
    for (const size of cases) {
      const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2 });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.PLAYTEST_URL || 'http://127.0.0.1:5173/');
      // Explicit simulated insets; this does not claim to emulate standalone Safari.
      await page.addStyleTag({ content: `:root { --game-safe-top: ${size.top}px; --game-safe-bottom: ${size.bottom}px; }
        ${baseline ? `.game-shell { padding-top: ${Math.max(7, size.top)}px; }` : ''}` });
      await page.waitForFunction(() => document.querySelector('canvas') && document.querySelector('#pause-btn').disabled);
      await page.locator('#overlay-button').click();
      await page.waitForFunction(() => document.querySelector('canvas').getBoundingClientRect().height <=
        document.querySelector('#game').getBoundingClientRect().height + 1);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const dimensions = await page.evaluate(() => {
        const box = selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
        };
        return { canvas: box('canvas'), hud: box('#hud'), preview: box('.gem-legend'), dock: box('#controls'),
          buttons: [...document.querySelectorAll('.control-button')].map(button => ({
            width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height,
            labelFits: button.querySelector('span').scrollWidth <= button.querySelector('span').clientWidth
          })) };
      });
      results.push({ ...size, ...dimensions });
      await page.screenshot({ path: path.join(output, `${baseline ? 'before' : 'after'}-${size.name}.png`) });
      if (!baseline) {
        assert.ok(Math.abs(dimensions.canvas.width / dimensions.canvas.height - 0.8) < 0.005, 'Board must scale uniformly');
        assert.ok(dimensions.canvas.y >= dimensions.preview.bottom - 1, 'Preview cannot cover board');
        assert.ok(dimensions.canvas.bottom <= dimensions.dock.y + 1, 'Controls cannot cover board');
        assert.ok(dimensions.dock.bottom <= size.height - size.bottom + 1, 'Controls must respect the home indicator inset');
        assert.ok(dimensions.dock.height <= 106, 'Decoration must not inflate the control row');
        for (const button of dimensions.buttons) {
          assert.ok(button.width >= 44 && button.height >= 44, 'Touch target must remain usable');
          assert.ok(button.labelFits, 'Control text cannot be clipped');
        }
        if (size.name === 'phone-reference') {
          assert.ok(dimensions.canvas.width >= 365, 'Reference phone needs a larger playfield');
        }
        await page.locator('#shuffle-btn').click();
        assert.equal(await page.locator('#shuffle-label').innerText(), '洗牌 x2');
        await page.locator('#pause-btn').click();
        assert.equal(await page.locator('#overlay-title').innerText(), '已暫停');
        await page.locator('#overlay-button').click();
        await page.locator('#sound-btn').click();
        assert.equal(await page.locator('#sound-btn').getAttribute('aria-pressed'), 'false');
        await page.locator('#hint-btn').click();
      }
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(output, `${baseline ? 'before' : 'after'}-layout.json`), JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
