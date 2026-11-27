import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { startServer } from './serve.mjs';

const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const outDir = new URL('../docs/screenshots/', import.meta.url);
await mkdir(outDir, { recursive: true });

const server = await startServer(0);
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none', '--hide-scrollbars'],
});

async function shot(page, name) {
  const path = join(outDir.pathname, name);
  await page.screenshot({ path, type: 'png' });
  console.log('wrote', name);
}

const desk = await browser.newPage();
await desk.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await desk.goto(base, { waitUntil: 'networkidle0' });
await desk.waitForSelector('[data-testid="slice-percent"]');
await new Promise((r) => setTimeout(r, 600));
await shot(desk, '01-hero-desktop.png');

await desk.evaluate(() => document.querySelector('#workspace')?.scrollIntoView({ block: 'start' }));
await new Promise((r) => setTimeout(r, 350));
await shot(desk, '02-workspace-desktop.png');

await desk.evaluate(() => document.querySelector('[data-testid="results"]')?.scrollIntoView({ block: 'start' }));
await new Promise((r) => setTimeout(r, 300));
await shot(desk, '03-results-desktop.png');

await desk.click('[data-testid="preset-shuffle"]');
await new Promise((r) => setTimeout(r, 500));
await desk.evaluate(() => document.querySelector('[data-testid="slice-card"]')?.scrollIntoView({ block: 'start' }));
await new Promise((r) => setTimeout(r, 300));
await shot(desk, '04-shuffle-desktop.png');

await desk.click('[data-testid="preset-employee"]');
await new Promise((r) => setTimeout(r, 500));
await desk.evaluate(() => document.querySelector('#workspace')?.scrollIntoView({ block: 'start' }));
await new Promise((r) => setTimeout(r, 300));
await shot(desk, '05-employee-desktop.png');

await desk.click('[data-testid="sources-open"]');
await new Promise((r) => setTimeout(r, 350));
await shot(desk, '06-method-desktop.png');
await desk.click('[data-testid="sources-close"]');

const mob = await browser.newPage();
await mob.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await mob.goto(base, { waitUntil: 'networkidle0' });
await mob.waitForSelector('[data-testid="slice-percent"]');
await new Promise((r) => setTimeout(r, 500));
await shot(mob, '07-hero-mobile.png');
await mob.evaluate(() => document.querySelector('#workspace')?.scrollIntoView({ block: 'start' }));
await new Promise((r) => setTimeout(r, 300));
await shot(mob, '08-workspace-mobile.png');

await browser.close();
await new Promise((r) => server.close(r));
const list = [
  '01-hero-desktop.png',
  '02-workspace-desktop.png',
  '03-results-desktop.png',
  '04-shuffle-desktop.png',
  '05-employee-desktop.png',
  '06-method-desktop.png',
  '07-hero-mobile.png',
  '08-workspace-mobile.png',
];
await writeFile(new URL('./INDEX.txt', outDir), `${list.join('\n')}\n`);
console.log('done');
