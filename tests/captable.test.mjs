import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { project, breakEvenExit, paperValue, compareFocus, INITIAL_FD } from '../public/js/core/captable.js';
import { defaultModel, getPreset, labVariants } from '../public/js/core/presets.js';
import { approx, row } from './helpers.mjs';

describe('garage incorporation', () => {
  it('splits 10M fully diluted shares around the option pool', () => {
    const p = project({
      founders: [
        { id: 'f-a', name: 'A', weight: 50 },
        { id: 'f-b', name: 'B', weight: 50 },
      ],
      poolPct: 0.10,
      safes: [],
      round: { enabled: false },
      grant: { enabled: false },
    });
    const g = p.stages[0];
    approx(g.totalFd, INITIAL_FD);
    approx(row(g, 'pool').percent, 0.10);
    approx(row(g, 'f-a').percent, 0.45);
    approx(row(g, 'f-b').percent, 0.45);
    approx(row(g, 'f-a').shares + row(g, 'f-b').shares, 9_000_000);
  });

  it('handles an uneven four-founder split', () => {
    const p = project(getPreset('shuffle').model);
    const g = p.stages[0];
    // 5% pool, 95% issued: Maya 40% of issued = 38% FD
    approx(row(g, 'f-a').percent, 0.95 * 0.40);
    approx(row(g, 'f-b').percent, 0.95 * 0.30);
    approx(row(g, 'f-c').percent, 0.95 * 0.20);
    approx(row(g, 'f-d').percent, 0.95 * 0.10);
  });
});

describe('post-money SAFE conversion', () => {
  it('gives a $1M SAFE at a $10M post-money cap exactly 10%', () => {
    const p = project({
      founders: [
        { id: 'f-a', name: 'A', weight: 50 },
        { id: 'f-b', name: 'B', weight: 50 },
      ],
      poolPct: 0.10,
      safes: [{ id: 'safe-1', name: 'SAFE', amount: 1_000_000, type: 'post', cap: 10_000_000, discount: 0 }],
      round: { enabled: false },
      grant: { enabled: false },
    });
    const s = p.stages.find((st) => st.key === 'safes');
    approx(row(s, 'safe-1').percent, 0.10, 1e-9);
    approx(row(s, 'f-a').percent, 0.45 * 0.9, 1e-9);
    approx(row(s, 'pool').percent, 0.10 * 0.9, 1e-9);
    approx(row(s, 'f-a').percent + row(s, 'f-b').percent + row(s, 'pool').percent + row(s, 'safe-1').percent, 1, 1e-9);
  });

  it('stacks two equal post-money SAFEs additively', () => {
    const p = project({
      founders: [{ id: 'f-a', name: 'A', weight: 100 }],
      poolPct: 0.10,
      safes: [
        { id: 's1', name: 'S1', amount: 500_000, type: 'post', cap: 10_000_000, discount: 0 },
        { id: 's2', name: 'S2', amount: 500_000, type: 'post', cap: 10_000_000, discount: 0 },
      ],
      round: { enabled: false },
      grant: { enabled: false },
    });
    const s = p.stages.find((st) => st.key === 'safes');
    approx(row(s, 's1').percent + row(s, 's2').percent, 0.10, 1e-9);
    approx(row(s, 's1').percent, 0.05, 1e-9);
  });
});

describe('pre-money SAFE conversion', () => {
  it('converts a $1M pre-money SAFE at a $10M cap against 10M FD into 9.09%', () => {
    const p = project({
      founders: [{ id: 'f-a', name: 'A', weight: 100 }],
      poolPct: 0,
      safes: [{ id: 'pre-1', name: 'Pre SAFE', amount: 1_000_000, type: 'pre', cap: 10_000_000, discount: 0 }],
      round: { enabled: false },
      grant: { enabled: false },
    });
    const s = p.stages.find((st) => st.key === 'safes');
    // shares = 1M * 10M / 10M = 1M; percent = 1/11
    approx(row(s, 'pre-1').shares, 1_000_000, 1e-6);
    approx(row(s, 'pre-1').percent, 1 / 11, 1e-9);
  });
});

describe('priced round and option-pool shuffle', () => {
  it('applies a 10% post-money pool refresh and 20% new money correctly', () => {
    const p = project({
      founders: [
        { id: 'f-a', name: 'A', weight: 50 },
        { id: 'f-b', name: 'B', weight: 50 },
      ],
      poolPct: 0.10,
      safes: [{ id: 'safe-1', name: 'SAFE', amount: 1_000_000, type: 'post', cap: 10_000_000, discount: 0 }],
      round: { enabled: true, name: 'Seed', amount: 2_000_000, preMoney: 8_000_000, poolTarget: 0.10 },
      grant: { enabled: false },
    });
    const r = p.stages.find((st) => st.key === 'round');
    approx(row(r, 'investor').percent, 0.20, 1e-9);
    approx(row(r, 'pool').percent, 0.10, 1e-9);
    // Issued after SAFE conversion is founders + SAFE shares (pool is unissued).
    // Those issued shares become 70% of post-money FD after a 10% pool + 20% new money.
    const safeShares = (INITIAL_FD / 0.9) * 0.10;
    const issuedAfterSafes = 9_000_000 + safeShares;
    const postFd = issuedAfterSafes / 0.70;
    approx(row(r, 'safe-1').percent, safeShares / postFd, 1e-6);
    approx(row(r, 'f-a').percent, 4_500_000 / postFd, 1e-6);
    // pool stage exists when shares were added
    const mid = p.stages.find((st) => st.key === 'pool');
    assert.ok(mid, 'expected a pool-refresh stage');
    assert.ok(mid.addedPool > 0);
  });

  it('skips the shuffle when the existing pool already meets the target', () => {
    const p = project({
      founders: [{ id: 'f-a', name: 'A', weight: 100 }],
      poolPct: 0.20,
      safes: [],
      round: { enabled: true, name: 'Seed', amount: 2_000_000, preMoney: 8_000_000, poolTarget: 0.10 },
      grant: { enabled: false },
    });
    const r = p.stages.find((st) => st.key === 'round');
    approx(row(r, 'investor').percent, 0.20, 1e-9);
    // No new pool shares: unissued 20% of 10M pre, post FD = 10M/0.8 = 12.5M, pool = 2M/12.5M = 16%
    approx(row(r, 'pool').percent, 2_000_000 / 12_500_000, 1e-9);
    assert.equal(p.stages.some((st) => st.key === 'pool'), false);
  });

  it('flags an incomplete priced round instead of inventing terms', () => {
    const p = project({
      founders: [{ id: 'f-a', name: 'A', weight: 100 }],
      poolPct: 0.10,
      round: { enabled: true, name: 'Seed', amount: 0, preMoney: 0, poolTarget: 0.1 },
      grant: { enabled: false },
    });
    assert.ok(p.warnings.some((w) => w.code === 'round-incomplete'));
    assert.equal(p.stages.some((st) => st.key === 'round'), false);
  });
});

describe('employee grant and early departure', () => {
  it('issues a 0.20% grant from the pool and vests 18/48 after the cliff', () => {
    const p = project(getPreset('employee').model);
    assert.equal(p.focus.id, 'grant');
    const g = p.stages.find((st) => st.key === 'grant');
    approx(row(g, 'grant').percent, 0.002, 1e-9);
    approx(p.focus.endPercent, 0.002, 1e-9);
    approx(p.focus.effectivePercent, 0.002 * (18 / 48), 1e-9);
    approx(p.grantInfo.fraction, 18 / 48);
    assert.ok(p.insights.some((i) => i.code === 'partial-vest'));
  });

  it('forfeits the whole grant when leaving before the cliff', () => {
    const model = { ...getPreset('employee').model, grant: { ...getPreset('employee').model.grant, leaveMonth: 8 } };
    const p = project(model);
    approx(p.focus.effectivePercent, 0);
    assert.ok(p.insights.some((i) => i.code === 'cliff-zero'));
  });
});

describe('paper value and break-even', () => {
  it('multiplies ownership by an exit value', () => {
    approx(paperValue(0.12, 100_000_000), 12_000_000);
    assert.equal(paperValue(0, 100_000_000), 0);
  });

  it('solves the exit that matches a four-year cash gap', () => {
    approx(breakEvenExit(0.10, 400_000), 4_000_000);
    assert.equal(breakEvenExit(0, 400_000), null);
  });

  it('attaches paper values and a break-even to the focus slice', () => {
    const p = project(defaultModel());
    assert.ok(p.focus.values.base > 0);
    assert.ok(p.focus.breakEven > 0);
    approx(p.focus.values.base, p.focus.effectivePercent * defaultModel().exits.base, 1e-4);
  });
});

describe('presets and lab variants', () => {
  it('shows the option-pool shuffle cutting Maya more than the new cash', () => {
    const p = project(getPreset('shuffle').model);
    assert.ok(p.insights.some((i) => i.code === 'shuffle-hurts-more'));
    // Maya starts at 38% and must be well below that after the seed.
    assert.ok(p.focus.startPercent > 0.37);
    assert.ok(p.focus.endPercent < 0.30);
  });

  it('keeps the YC batch founder above 30% after a standard seed', () => {
    const p = project(defaultModel());
    assert.ok(p.focus.endPercent > 0.30);
    assert.ok(p.focus.endPercent < 0.45);
    const r = p.stages.find((st) => st.key === 'round');
    approx(row(r, 'investor').percent, 3_500_000 / (17_000_000 + 3_500_000), 1e-9);
  });

  it('compares a +5 point pool against a +$2M raise', () => {
    const base = defaultModel();
    const { pool, raise } = labVariants(base);
    const vsPool = compareFocus(base, pool.model);
    const vsRaise = compareFocus(base, raise.model);
    assert.ok(vsPool.deltaPercent < 0, 'a larger pool should dilute the focus');
    assert.ok(vsRaise.deltaPercent < 0, 'a larger raise should dilute the focus');
  });
});

describe('discount conversion', () => {
  it('uses the discount when it beats the cap in a cheap priced round', () => {
    const p = project({
      founders: [{ id: 'f-a', name: 'A', weight: 100 }],
      poolPct: 0,
      safes: [{ id: 's', name: 'SAFE', amount: 1_000_000, type: 'post', cap: 50_000_000, discount: 0.2 }],
      round: { enabled: true, name: 'Seed', amount: 2_000_000, preMoney: 8_000_000, poolTarget: 0 },
      grant: { enabled: false },
    });
    const r = p.stages.find((st) => st.key === 'round');
    // Cap alone would be only 2%. A 20% discount on an $8M pre / 10M shares
    // priced round ($0.80/share, discounted $0.64) yields 1,000,000/0.64 ≈ 1.5625M
    // shares, well above a 2% cap conversion.
    const safe = row(r, 's');
    assert.ok(safe.percent > 0.10, `expected discount to beat cap, got ${safe.percent}`);
  });
});
