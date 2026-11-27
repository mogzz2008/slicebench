// Records the live Slicebench app at 1280x720 / 30 fps and builds docs/demo.mp4
// with edge-tts narration plus a ducked, synthesized music bed.
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { startServer } from '../scripts/serve.mjs';
import { scenes, VOICE, RATE } from './scenes.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const W = `${ROOT}video-src/work`;
const FR = `${W}/frames`;
const OUT = process.argv[2] || `${ROOT}docs/demo.mp4`;
const TTS = '/workspace/tts-venv/bin/edge-tts';
const LEAD = 0.28;
const GAP = 0.18;
const TAIL = 0.5;
const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 }).toString().trim();
const dur = (f) => parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));

mkdirSync(`${W}/a`, { recursive: true });
mkdirSync(`${W}/c`, { recursive: true });
rmSync(FR, { recursive: true, force: true });
mkdirSync(FR, { recursive: true });

for (const s of scenes) {
  let t = LEAD;
  const parts = [];
  for (const [i, seg] of s.segs.entries()) {
    const hsh = createHash('sha1').update(`${VOICE}${RATE}${seg.text}`).digest('hex').slice(0, 10);
    const mp3 = `${W}/a/${s.id}-${i}-${hsh}.mp3`;
    if (!existsSync(mp3)) sh(TTS, ['--voice', VOICE, `--rate=${RATE}`, '--text', seg.text, '--write-media', mp3]);
    seg.mp3 = mp3;
    seg.d = dur(mp3);
    seg.at = t;
    parts.push(seg);
    t += seg.d + GAP;
  }
  s.total = +(t - GAP + TAIL).toFixed(3);
  if (s.id === 'end') s.total += 2.0;
  if (s.id === 'title') s.total += 0.4;
  const inputs = parts.flatMap((p) => ['-i', p.mp3]);
  const filt = parts.map((p, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(p.at * 1000)}|${Math.round(p.at * 1000)}[a${i}]`).join(';')
    + `;${parts.map((_, i) => `[a${i}]`).join('')}amix=inputs=${parts.length}:normalize=0,apad,atrim=0:${s.total}[out]`;
  s.wav = `${W}/a/${s.id}.wav`;
  sh('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filt, '-map', '[out]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', s.wav]);
}
const total = scenes.reduce((a, s) => a + s.total, 0);
console.log(scenes.map((s) => `${s.id}:${s.total.toFixed(1)}s`).join('  '), `TOTAL ${total.toFixed(1)}s`);
if (total > 135) console.warn(`duration ${total.toFixed(1)}s is over the 2:15 target`);
if (process.env.ONLY_AUDIO) process.exit(0);

mkdirSync(`${W}/out`, { recursive: true });
sh('python3', [`${ROOT}video-src/music.py`, String(Math.ceil(total + 2)), `${W}/out/music.wav`]);

const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base, { waitUntil: 'networkidle0' });
await page.waitForSelector('[data-testid="slice-percent"]');

await page.addStyleTag({ content: `
.results-col{max-height:calc(100vh - 16px)!important;overflow-y:auto!important;}
#vc{position:fixed;left:0;top:0;width:26px;height:26px;z-index:9999;pointer-events:none;transform:translate(-100px,-100px)}
#vc svg{filter:drop-shadow(0 3px 6px rgba(0,0,0,.6))}
#vc.down svg{transform:scale(.82);transform-origin:4px 4px}
.vc-ring{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #e3933a;z-index:9998;pointer-events:none;animation:vcr .5s ease-out forwards}
@keyframes vcr{from{transform:scale(.3);opacity:.9}to{transform:scale(1.4);opacity:0}}
#cap{position:fixed;left:28px;right:28px;bottom:22px;z-index:8000;pointer-events:none;font:650 22px Outfit,sans-serif;letter-spacing:-.02em;color:#f6f0e4;text-shadow:0 2px 16px #000;background:rgba(8,9,12,.55);border:1px solid rgba(246,240,228,.14);border-radius:14px;padding:10px 16px;backdrop-filter:blur(10px);opacity:0;transform:translateY(8px);transition:opacity .25s ease,transform .25s ease}
#cap.on{opacity:1;transform:none}
#titlecard,#endcard{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;background:radial-gradient(900px 520px at 50% 40%,#24180e,#100e0c);text-align:center;color:#f3ead8}
#titlecard h1,#endcard h1{font:800 92px/0.95 Syne,sans-serif;letter-spacing:-.06em;margin:0}
#titlecard h1 em,#endcard h1 em{font-style:normal;background:linear-gradient(120deg,#ffb25a,#3ad7b8);-webkit-background-clip:text;background-clip:text;color:transparent}
#titlecard p,#endcard p{font:500 26px Outfit,sans-serif;color:#c9bba3;margin:16px 0 0}
#endcard small{display:block;margin-top:28px;font:600 15px "Geist Mono",monospace;color:#e3933a;letter-spacing:.12em}
@keyframes ecIn{from{opacity:0;transform:scale(1.05)}to{opacity:1;transform:none}}
#titlecard,#endcard{animation:ecIn .6s cubic-bezier(.16,1,.3,1) both}
` });

await page.evaluate(() => {
  const c = document.createElement('div');
  c.id = 'vc';
  c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M3 2l7 19 2.6-7.6L20 11z" fill="#fff" stroke="#16120a" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.body.appendChild(c);
  addEventListener('mousemove', (e) => { c.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`; }, { capture: true });
  addEventListener('mousedown', (e) => {
    c.classList.add('down');
    const r = document.createElement('div');
    r.className = 'vc-ring';
    r.style.left = `${e.clientX}px`;
    r.style.top = `${e.clientY}px`;
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 600);
  }, { capture: true });
  addEventListener('mouseup', () => c.classList.remove('down'), { capture: true });
});

let mouse = { x: 640, y: 360 };
await page.mouse.move(mouse.x, mouse.y);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const center = async (sel) => page.$eval(sel, (n) => {
  const r = n.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
const glide = async (x, y, ms = 650) => {
  const steps = Math.max(8, Math.round(ms / 16));
  const from = { ...mouse };
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const e = t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await sleep(ms / steps);
  }
  mouse = { x, y };
};

const h = {
  sleep,
  eval: (fn) => page.evaluate(fn),
  caption: (text) => page.evaluate((t) => {
    let el = document.getElementById('cap');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cap';
      document.body.appendChild(el);
    }
    el.textContent = t;
    el.classList.add('on');
  }, text),
  titleCard: () => page.evaluate(() => {
    document.getElementById('titlecard')?.remove();
    document.getElementById('endcard')?.remove();
    const d = document.createElement('div');
    d.id = 'titlecard';
    d.innerHTML = '<div><h1>Slice<em>bench</em></h1><p>See what\'s left after the next two rounds.</p></div>';
    document.body.appendChild(d);
  }),
  hideTitle: async () => {
    await page.evaluate(() => document.getElementById('titlecard')?.remove());
  },
  endCard: () => page.evaluate(() => {
    document.getElementById('vc') && (document.getElementById('vc').style.display = 'none');
    document.getElementById('cap')?.classList.remove('on');
    document.getElementById('titlecard')?.remove();
    const d = document.createElement('div');
    d.id = 'endcard';
    d.innerHTML = '<div><h1>Slice<em>bench</em></h1><p>See what\'s left, before you sign.</p><small>SILICON VALLEY BUILDATHON 2026 · PRIVATE BY DESIGN</small></div>';
    document.body.appendChild(d);
  }),
  hover: async (sel) => {
    const c = await center(sel);
    await glide(c.x, c.y, 700);
  },
  click: async (sel) => {
    const c = await center(sel);
    await glide(c.x, c.y, 550);
    await page.mouse.click(c.x, c.y);
    await sleep(250);
  },
  quickClick: async (sel) => {
    await page.waitForSelector(sel, { visible: true, timeout: 5000 });
    await page.click(sel);
    await sleep(150);
  },
  setSelect: async (sel, value) => {
    await page.waitForSelector(sel, { visible: true, timeout: 5000 });
    await page.select(sel, value);
    await sleep(180);
  },
  waitForText: async (sel, text, timeout = 8000) => {
    await page.waitForFunction((s, needle) => (document.querySelector(s)?.textContent || '').includes(needle), { timeout }, sel, text);
  },
  scrollPanel: async (sel, panel = '[data-testid="results"]', pad = 32) => {
    await page.$eval(sel, (n, panelSel, padPx) => {
      const col = document.querySelector(panelSel);
      if (!col) { n.scrollIntoView({ block: 'center' }); return; }
      const top = n.getBoundingClientRect().top - col.getBoundingClientRect().top + col.scrollTop - padPx;
      col.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, panel, pad);
    await sleep(420);
  },
  type: async (sel, text, delay = 80) => {
    await page.waitForSelector(sel, { timeout: 5000 });
    await page.$eval(sel, (el) => {
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      el.focus();
      el.select();
    });
    await sleep(80);
    const c = await center(sel);
    await glide(c.x, c.y - 8, 180);
    await page.mouse.click(c.x, c.y - 8);
    await page.$eval(sel, (el) => { el.focus(); el.select(); });
    await page.keyboard.press('Backspace');
    await page.keyboard.type(text, { delay });
    await page.$eval(sel, (el, v) => {
      if (String(el.value).replace(/[,\s$]/g, '') !== String(v)) {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, text);
    await page.keyboard.press('Tab');
  },
  scrollTo: async (sel, offset = 0, ms = 900) => {
    const y = await page.$eval(sel, (n, off) => n.getBoundingClientRect().top + window.scrollY + off, offset);
    const start = await page.evaluate(() => window.scrollY);
    const steps = Math.max(8, Math.round(ms / 16));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const e = t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
      await page.evaluate((v) => window.scrollTo(0, v), start + (y - start) * e);
      await sleep(ms / steps);
    }
  },
};

const cdp = await page.createCDPSession();
const frames = [];
let pending = Promise.resolve();
cdp.on('Page.screencastFrame', (f) => {
  const n = frames.length;
  const file = `${FR}/${String(n).padStart(6, '0')}.jpg`;
  frames.push({ ts: f.metadata.timestamp, file });
  writeFileSync(file, Buffer.from(f.data, 'base64'));
  pending = cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
await sleep(400);

for (const s of scenes) {
  await page.evaluate(() => getSelection().removeAllRanges());
  s.start = Date.now() / 1000;
  let chain = Promise.resolve();
  const timers = s.segs.map((seg) => {
    chain = Promise.all([sleep(seg.at * 1000), chain]).then(() => seg.act(h)).catch((e) => errors.push(`${s.id}: ${e.message}`));
    return chain;
  });
  await sleep(s.total * 1000);
  await Promise.all(timers);
  console.log(`recorded ${s.id} (${s.total.toFixed(1)}s), frames so far ${frames.length}`);
}

const endTs = Date.now() / 1000;
await sleep(300);
await cdp.send('Page.stopScreencast');
await pending;
await browser.close();
server.close();
if (errors.length) {
  console.error('ERRORS during recording:', errors);
  process.exit(1);
}
console.log(`captured ${frames.length} frames over ${(endTs - scenes[0].start).toFixed(1)}s`);

const clips = [];
for (const s of scenes) {
  const a = s.start;
  const b = s.start + s.total;
  let idx = frames.findIndex((f) => f.ts > a);
  if (idx < 0) idx = frames.length - 1;
  const first = Math.max(0, idx - 1);
  const list = [];
  let t = a;
  for (let i = first; i < frames.length && t < b; i += 1) {
    const nextTs = i + 1 < frames.length ? Math.min(frames[i + 1].ts, b) : b;
    const d = nextTs - t;
    if (d <= 0) continue;
    list.push(`file '${frames[i].file}'\nduration ${d.toFixed(5)}`);
    t = nextTs;
  }
  list.push(`file '${frames[Math.min(frames.length - 1, first + list.length)].file}'`);
  const lf = `${W}/c/${s.id}.txt`;
  writeFileSync(lf, list.join('\n'));
  const clip = `${W}/c/${s.id}.mp4`;
  const vf = `fps=30,scale=1280:720:flags=lanczos:in_range=pc:out_range=tv,setsar=1,tpad=stop_mode=clone:stop_duration=2,format=yuv420p${s.id === 'title' ? ',fade=t=in:st=0:d=0.35' : ''}${s.id === 'end' ? `,fade=t=out:st=${(s.total - 0.45).toFixed(2)}:d=0.4` : ''}`;
  const af = `aresample=48000${s.id === 'end' ? `,afade=t=out:st=${(s.total - 0.4).toFixed(2)}:d=0.4` : ''}`;
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lf, '-i', s.wav, '-vf', vf, '-af', af, '-t', s.total.toFixed(3),
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-r', '30', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-g', '60',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', clip]);
  clips.push(clip);
  console.log(`clip ${s.id}: ${dur(clip).toFixed(2)}s`);
}

const voice = `${W}/c/_voice.mp4`;
const inputs = clips.flatMap((c) => ['-i', c]);
const concat = `${clips.map((_, i) => `[${i}:v:0][${i}:a:0]`).join('')}concat=n=${clips.length}:v=1:a=1[v0][a0];[v0]format=yuv420p[v];[a0]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`;
sh('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', concat, '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', voice]);

const music = `${W}/out/music.wav`;
const fadeStart = Math.max(0, dur(voice) - 2.4).toFixed(2);
sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', voice, '-i', music, '-filter_complex',
  `[1:a]atrim=0:${dur(voice).toFixed(3)},afade=t=in:d=0.8,afade=t=out:st=${fadeStart}:d=2.2,volume=0.11,aresample=48000[m];[0:a]asplit=2[vx][key];[m][key]sidechaincompress=threshold=0.06:ratio=7:attack=25:release=280:makeup=2[ducked];[vx][ducked]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95,aresample=48000[a]`,
  '-map', '0:v', '-map', '[a]',
  '-c:v', 'copy',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', OUT]);

writeFileSync(`${W}/timeline.json`, JSON.stringify(scenes.map((s, i) => ({
  id: s.id,
  start: +scenes.slice(0, i).reduce((x, y) => x + y.total, 0).toFixed(2),
  dur: s.total,
  segs: s.segs.map((g) => ({ at: +g.at.toFixed(2), text: g.text })),
})), null, 1));
console.log(`done ${OUT} ${dur(OUT).toFixed(2)}s`);
