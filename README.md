# Slicebench

**See what's left after the next two rounds.**

A 50/50 founding split is not what you own after a SAFE and a seed. Slicebench is a cap-table workbench for the garage years: it converts post-money (and pre-money) SAFEs, the option-pool shuffle, and standard four-year vesting into a live picture of your slice — before you sign.

This is a client-side web app built for [Silicon Valley Buildathon](https://silicon-valley-buildathon.devpost.com/). There is no backend and no account. Every calculation runs in the browser. Share links encode the deal in the URL hash.

**Live demo:** <https://mogzz2008.github.io/slicebench/>

## Try it

Open the live app (or `npm run serve` after install) and click one of the three presets:

1. **Two founders, YC batch** — a 50/50 split, a $500k post-money SAFE at a $12.5M cap, then a $3.5M seed at $17M pre with a 10% post-money pool refresh.
2. **The option-pool shuffle** — four founders and a seed that demands a 20% post-money pool. Watch the refresh take a bigger bite than the new cash.
3. **Employee, leave at 18 months** — a 0.20% grant after the seed, four-year vest, one-year cliff. See what is still yours if you walk at month 18.

Then pull any lever. The ownership stack, paper values, and “what we tested” lab update immediately. Copy a share link, download JSON, or print a one-pager.

## What the math includes

- **Incorporation** of 10,000,000 fully diluted shares, with an unissued option pool and founder weights over the issued common.
- **Post-money SAFEs** in the spirit of the Y Combinator post-money SAFE: a SAFE with amount *A* and cap *C* is promised *A / C* of the company immediately after conversion and immediately before new priced-round money or a new pool refresh. Multiple post-money SAFEs stack.
- **Pre-money SAFEs**, converting simultaneously against the same pre-SAFE fully diluted count.
- **Discount versus cap**, using the lower of the cap price and the discounted priced-round price, with one iteration once the round price is known.
- **The option-pool shuffle:** a post-money unissued-pool target carved from the pre-money, so new cash investors are not diluted by the refresh.
- **Standard vesting:** monthly over the vest period, with a cliff. Leave before the cliff and nothing has vested.
- **Paper value** at three exits, and the exit that would match a four-year cash gap (the job you didn't take). No taxes, no liquidation preferences.

Slicebench is an estimate for comparing term-sheet shapes, **not legal, tax, or financing advice**. Confirm numbers with counsel and a real 409A before you sign.

## Stack

- Static HTML, CSS, and ES modules. No framework, no build step, no tracking.
- Pure cap-table and vesting engine in `public/js/core/`, covered by `npm test`.
- GitHub Pages via GitHub Actions (lint + unit tests, then deploy `public/`).
- Subtle Web Audio cues with a mute toggle (sound starts off).

## Develop

```bash
npm ci
npm test
npm run lint
npm run serve          # http://127.0.0.1:8080
npm run qa:browser     # headless Chrome E2E, including a mobile viewport
npm run check
```

Requires Chrome at `/usr/bin/google-chrome` (or set `CHROME`) for the browser suite.

## License

MIT. Display fonts are Syne, Outfit, and Geist Mono, each under the SIL Open Font License (see `public/fonts/`).
