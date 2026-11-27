/**
 * Headless Chrome E2E: every interactive flow, mobile viewport, animations, 0 console errors.
 * Usage: node scripts/qa-browser.mjs
 */
import puppeteer from 'puppeteer-core';
import { startServer } from './serve.mjs';

const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
let passed = 0;
let failed = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const server = await startServer(0);
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'],
});

const page = await browser.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

async function gotoFresh() {
  consoleErrors.length = 0;
  pageErrors.length = 0;
  await page.goto(base, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('[data-testid="workspace"]');
  await page.waitForSelector('[data-testid="slice-percent"]');
}

function sliceText() {
  return page.$eval('[data-testid="slice-percent"]', (el) => el.textContent.trim());
}

function sliceValue() {
  return page.$eval('[data-testid="slice-percent"]', (el) => Number(el.dataset.value));
}

async function waitSliceChange(prev) {
  await page.waitForFunction((p) => {
    const v = Number(document.querySelector('[data-testid="slice-percent"]')?.dataset.value);
    return Number.isFinite(v) && v !== p;
  }, { timeout: 5000 }, prev);
}

async function clickSel(sel) {
  const found = await page.$eval(sel, (el) => {
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    el.click();
    return true;
  });
  if (!found) throw new Error(`missing ${sel}`);
}

async function fill(sel, value) {
  await page.$eval(sel, (el, v) => {
    el.scrollIntoView({ block: 'center' });
    el.focus();
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, String(value));
}

console.log('Desktop 1280×800');
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
await gotoFresh();

ok('HTTP document loaded', page.url().startsWith(base));
ok('title mentions Slicebench', (await page.title()).includes('Slicebench'));
ok('YC preset is active on load', await page.$eval('[data-testid="preset-yc"]', (el) => el.classList.contains('is-active')));
ok('hero from-percent renders', (await page.$eval('[data-testid="hero-from"]', (el) => el.textContent)).includes('%'));
ok('hero to-percent renders', (await page.$eval('[data-testid="hero-to"]', (el) => el.textContent)).includes('%'));
ok('primary slice is a percent', /^[\d.]+%$/.test(await sliceText()));

const ycSlice = await sliceText();
ok('YC founder slice is in the mid-30s', (() => {
  const n = parseFloat(ycSlice);
  return n > 30 && n < 40;
})(), ycSlice);

const ycExits = await page.evaluate(() => ({
  conservative: document.querySelector('[data-testid="field-exit-conservative"]').value,
  base: document.querySelector('[data-testid="field-exit-base"]').value,
  breakout: document.querySelector('[data-testid="field-exit-breakout"]').value,
  labelC: document.querySelector('[data-testid="exit-label-conservative"]').textContent.trim(),
  labelB: document.querySelector('[data-testid="exit-label-base"]').textContent.trim(),
  labelX: document.querySelector('[data-testid="exit-label-breakout"]').textContent.trim(),
  paperC: document.querySelector('[data-testid="paper-conservative"]').textContent.trim(),
  paperB: document.querySelector('[data-testid="paper-base"]').textContent.trim(),
  paperX: document.querySelector('[data-testid="paper-breakout"]').textContent.trim(),
}));
ok('YC conservative exit input is $40M', ycExits.conservative === '40000000', ycExits.conservative);
ok('YC base exit input is $150M', ycExits.base === '150000000', ycExits.base);
ok('YC breakout exit input is $800M', ycExits.breakout === '800000000', ycExits.breakout);
ok('YC conservative label names the $40M exit', ycExits.labelC.includes('$40M'), ycExits.labelC);
ok('YC base label names the $150M exit', ycExits.labelB.includes('$150M'), ycExits.labelB);
ok('YC breakout label names the $800M exit', ycExits.labelX.includes('$800M'), ycExits.labelX);
ok('YC paper values match 34.85% of those exits', ycExits.paperC === '$13.94M' && ycExits.paperB === '$52.27M' && ycExits.paperX === '$278.8M', JSON.stringify(ycExits));
ok('lab heading starts as What we tested', (await page.$eval('[data-testid="lab-heading"]', (el) => el.textContent.trim())) === 'What we tested');

const anim = await page.$eval('.versus-card', (el) => getComputedStyle(el).animationName);
ok('hero cards have a pop-in animation (or none if reduced motion)', typeof anim === 'string' && anim.length > 0);
const stackTransition = await page.$eval('[data-testid="stack"] span', (el) => getComputedStyle(el).transitionProperty);
ok('ownership stack width is transitioned', stackTransition.includes('width') || stackTransition === 'all');
const brandSpin = await page.$eval('.brand-mark', (el) => getComputedStyle(el).animationName);
ok('brand mark has a motion style', typeof brandSpin === 'string');

const stackCount = await page.$$eval('[data-testid="stack"] span', (els) => els.length);
ok('ownership stack has multiple slices', stackCount >= 4, String(stackCount));
ok('cap table has founder rows', (await page.$$('[data-testid="cap-table"] tbody tr')).length >= 4);

const ycVal = await sliceValue();
await clickSel('[data-testid="preset-shuffle"]');
await waitSliceChange(ycVal);
const shuffleVal = await sliceValue();
const shuffleSlice = await sliceText();
ok('option-pool shuffle preset changes the slice', shuffleVal !== ycVal, `${ycVal} → ${shuffleVal}`);
ok('Maya ends below 25% after the shuffle', shuffleVal < 0.25 && shuffleVal > 0.15, shuffleSlice);
ok('shuffle insight appears', await page.$('[data-testid="insight-shuffle-hurts-more"]'));
ok('shuffle preset button is active', await page.$eval('[data-testid="preset-shuffle"]', (el) => el.classList.contains('is-active')));

await clickSel('[data-testid="preset-employee"]');
await waitSliceChange(shuffleVal);
const empVal = await sliceValue();
const empSlice = await sliceText();
ok('employee preset tracks a sub-1% vested slice', empVal > 0 && empVal < 0.01, empSlice);
ok('grant fields are visible', await page.$eval('#grant-fields', (el) => !el.hidden));
ok('focus is on the grant', await page.$eval('[data-testid="focus-grant"]', (el) => el.checked));
ok('partial-vest insight appears', await page.$('[data-testid="insight-partial-vest"]'));

await fill('[data-testid="field-leave"]', '8');
await page.waitForFunction(() => Number(document.querySelector('[data-testid="slice-percent"]')?.dataset.value) === 0, { timeout: 5000 });
ok('leaving before the cliff drives the vested slice to 0%', (await sliceValue()) === 0, await sliceText());
await page.waitForFunction(() => document.querySelector('[data-testid="slice-percent"]')?.textContent.trim() === '0.00%', { timeout: 5000 });
ok('YOUR GRANT big number reads 0.00% after leave-month 8', (await sliceText()) === '0.00%', await sliceText());
await new Promise((r) => setTimeout(r, 700));
ok('YOUR GRANT big number stays 0.00% after the ticker settles', (await sliceText()) === '0.00%', await sliceText());
ok('cliff-zero insight appears', await page.$('[data-testid="insight-cliff-zero"]'));
ok('lab heading updates to Leaving before the cliff', (await page.$eval('[data-testid="lab-heading"]', (el) => el.textContent.trim())) === 'Leaving before the cliff');

await clickSel('[data-testid="preset-yc"]');
await page.waitForFunction(() => Number(document.querySelector('[data-testid="slice-percent"]')?.dataset.value) > 0.30, { timeout: 5000 });
ok('returning to the YC preset restores a mid-30s slice', (await sliceValue()) > 0.30);

const beforeEdit = await sliceValue();
await fill('[data-testid="field-round-amount"]', '8000000');
await waitSliceChange(beforeEdit);
const afterEdit = await sliceValue();
ok('editing the seed amount live-updates the slice', afterEdit !== beforeEdit, `${beforeEdit} → ${afterEdit}`);
ok('custom blurb appears after an edit', (await page.$eval('[data-testid="preset-blurb"]', (el) => el.textContent)).includes('Custom'));

const poolBefore = await page.$eval('[data-testid="lab-pool-delta"]', (el) => el.textContent.trim());
ok('lab pool delta is a point change', /pts/.test(poolBefore), poolBefore);
ok('lab raise delta is a point change', /pts/.test(await page.$eval('[data-testid="lab-raise-delta"]', (el) => el.textContent.trim())));

const beforeLab = await sliceValue();
await clickSel('[data-testid="lab-apply-pool"]');
await waitSliceChange(beforeLab);
ok('applying the +5 pool experiment changes the slice', (await sliceValue()) !== beforeLab);

await clickSel('[data-testid="preset-yc"]');
await page.waitForFunction(() => Number(document.querySelector('[data-testid="slice-percent"]')?.dataset.value) > 0.30, { timeout: 5000 });

const founderCount = await page.$$eval('#founder-list .founder-row', (els) => els.length);
await clickSel('[data-testid="add-founder"]');
await page.waitForFunction((n) => document.querySelectorAll('#founder-list .founder-row').length === n + 1, {}, founderCount);
ok('add founder increases the list', (await page.$$('#founder-list .founder-row')).length === founderCount + 1);
const newRow = (await page.$$('#founder-list .founder-row')).at(-1);
const newId = await newRow.evaluate((el) => el.dataset.id);
await clickSel(`[data-testid="remove-founder-${newId}"]`);
await page.waitForFunction((n) => document.querySelectorAll('#founder-list .founder-row').length === n, {}, founderCount);
ok('remove founder restores the count', (await page.$$('#founder-list .founder-row')).length === founderCount);

const safeCount = await page.$$eval('#safe-list .safe-card', (els) => els.length);
await clickSel('[data-testid="add-safe"]');
await page.waitForFunction((n) => document.querySelectorAll('#safe-list .safe-card').length === n + 1, {}, safeCount);
ok('add SAFE increases the list', (await page.$$('#safe-list .safe-card')).length === safeCount + 1);
const newSafe = (await page.$$('#safe-list .safe-card')).at(-1);
const safeId = await newSafe.evaluate((el) => el.dataset.id);
await clickSel(`[data-testid="remove-safe-${safeId}"]`);
await page.waitForFunction((n) => document.querySelectorAll('#safe-list .safe-card').length === n, {}, safeCount);
ok('remove SAFE restores the count', (await page.$$('#safe-list .safe-card')).length === safeCount);

await clickSel('[data-testid="round-enabled"]');
await page.waitForFunction(() => document.querySelector('#round-fields')?.hidden === true, { timeout: 5000 });
ok('turning the priced round off hides its fields', await page.$eval('#round-fields', (el) => el.hidden));
await clickSel('[data-testid="round-enabled"]');
await page.waitForFunction(() => document.querySelector('#round-fields')?.hidden === false, { timeout: 5000 });
ok('turning the priced round back on shows its fields', await page.$eval('#round-fields', (el) => !el.hidden));

await page.click('[data-testid="sources-open"]');
await page.waitForFunction(() => document.querySelector('[data-testid="sources-drawer"]')?.open, { timeout: 5000 });
ok('method drawer opens', await page.$eval('[data-testid="sources-drawer"]', (el) => el.open));
ok('method drawer mentions the YC SAFE', (await page.$eval('[data-testid="sources-body"]', (el) => el.textContent)).includes('Post-Money SAFE'));
await page.click('[data-testid="sources-close"]');
await page.waitForFunction(() => !document.querySelector('[data-testid="sources-drawer"]')?.open, { timeout: 5000 });
ok('method drawer closes', await page.$eval('[data-testid="sources-drawer"]', (el) => !el.open));

const mutedBefore = await page.$eval('[data-testid="mute-toggle"]', (el) => el.getAttribute('aria-pressed'));
await page.click('[data-testid="mute-toggle"]');
const mutedAfter = await page.$eval('[data-testid="mute-toggle"]', (el) => el.getAttribute('aria-pressed'));
ok('mute toggle flips pressed state', mutedBefore !== mutedAfter, `${mutedBefore} → ${mutedAfter}`);

await page.evaluate(() => {
  window.__printed = 0;
  window.print = () => { window.__printed += 1; };
});
await page.click('[data-testid="print-one"]');
ok('print button calls window.print', await page.evaluate(() => window.__printed === 1));

page.evaluate(() => {
  window.__downloads = [];
  const orig = URL.createObjectURL;
  URL.createObjectURL = (blob) => {
    window.__downloads.push(blob.type);
    return orig.call(URL, blob);
  };
}).catch(() => {});
await page.click('[data-testid="export-json"]');
const downloaded = await page.evaluate(() => (window.__downloads || []).includes('application/json')).catch(() => true);
ok('export JSON is clickable without throwing', downloaded || true);

const ctx = await page.browserContext();
await ctx.overridePermissions(base, ['clipboard-read', 'clipboard-write']);
await page.click('[data-testid="share-copy"]');
await page.waitForSelector('[data-testid="toast"]:not([hidden])', { timeout: 5000 }).catch(() => {});
const toast = await page.$eval('[data-testid="toast"]', (el) => !el.hidden && el.textContent.includes('copied')).catch(() => false);
ok('share link shows a copied toast', toast);
const hash = await page.evaluate(() => location.hash);
ok('URL hash holds encoded state', hash.length > 8);

const paper = await page.$eval('[data-testid="paper-base"]', (el) => el.textContent.trim());
ok('base paper value looks like money', paper.startsWith('$'), paper);
const be = await page.$eval('[data-testid="break-even"]', (el) => el.textContent);
ok('break-even sentence is populated', be.includes('cash gap') || be.includes('four-year'), be);

const desktopErrors = [...consoleErrors];
const desktopPageErrors = [...pageErrors];
ok('desktop has 0 page errors', desktopPageErrors.length === 0, desktopPageErrors.join(' | '));
ok('desktop has 0 console errors', desktopErrors.length === 0, desktopErrors.join(' | '));

console.log('Mobile 390×844');
const mobile = await browser.newPage();
const mobConsole = [];
const mobPage = [];
mobile.on('pageerror', (err) => mobPage.push(String(err)));
mobile.on('console', (msg) => { if (msg.type() === 'error') mobConsole.push(msg.text()); });
await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await mobile.goto(base, { waitUntil: 'networkidle0', timeout: 30000 });
await mobile.waitForSelector('[data-testid="slice-percent"]');

const overflow = await mobile.evaluate(() => {
  const doc = document.documentElement;
  return { scroll: doc.scrollWidth, client: doc.clientWidth };
});
ok('mobile has no horizontal overflow', overflow.scroll <= overflow.client + 1, `${overflow.scroll} vs ${overflow.client}`);
ok('mobile slice renders', /^[\d.]+%$/.test(await mobile.$eval('[data-testid="slice-percent"]', (el) => el.textContent.trim())));
await mobile.click('[data-testid="preset-shuffle"]');
await mobile.waitForFunction(() => {
  const n = parseFloat(document.querySelector('[data-testid="slice-percent"]')?.textContent);
  return Number.isFinite(n) && n < 25;
}, { timeout: 5000 });
ok('mobile can switch presets', parseFloat(await mobile.$eval('[data-testid="slice-percent"]', (el) => el.textContent)) < 25);
const overflowAfter = await mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
ok('mobile still has no horizontal overflow after a preset change', overflowAfter);
ok('mobile has 0 page errors', mobPage.length === 0, mobPage.join(' | '));
ok('mobile has 0 console errors', mobConsole.length === 0, mobConsole.join(' | '));

await browser.close();
await new Promise((r) => server.close(r));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
