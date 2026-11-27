/**
 * Slicebench cap-table engine.
 *
 * Models a garage incorporation, one or more SAFEs, an optional priced equity
 * round with a pre-money option-pool refresh, and an optional employee grant
 * with standard vesting. All math is deterministic and client-side.
 *
 * Post-money SAFE conversion follows the YC post-money SAFE idea: a SAFE with
 * purchase amount A and post-money cap C is promised A/C of the company
 * immediately after SAFE conversion and immediately before new priced-round
 * money (and before a new pool refresh). Pre-money SAFEs convert as
 * shares = A * preSafeFD / C, issued simultaneously against the same pre-SAFE
 * fully-diluted count so they do not dilute each other.
 *
 * The "option-pool shuffle" increases the unissued pool so that it equals a
 * target fraction of post-money fully-diluted shares, with the new pool
 * shares issued on a pre-money basis (they dilute existing holders, not the
 * new cash investors).
 *
 * This is an educational model for comparing term-sheet shapes, not legal,
 * tax, or financing advice. Real closings use counsel and a 409A.
 */

import { clamp } from './format.js';
import { vestedFraction } from './vesting.js';

export const INITIAL_FD = 10_000_000;

export function emptyWarnings() {
  return [];
}

function warning(warnings, code, message) {
  warnings.push({ code, message });
}

function newId(prefix, i) {
  return `${prefix}-${i}`;
}

export function normalizeModel(raw = {}) {
  const warnings = [];
  const poolPct = clamp(raw.poolPct ?? 0.10, 0, 0.5);
  const fd = INITIAL_FD;
  const poolShares = fd * poolPct;
  const issued = fd - poolShares;

  const rawFounders = Array.isArray(raw.founders) && raw.founders.length
    ? raw.founders
    : [{ id: 'f-a', name: 'Founder A', weight: 50 }, { id: 'f-b', name: 'Founder B', weight: 50 }];

  const weights = rawFounders.map((f, i) => ({
    id: String(f.id || newId('f', i)),
    name: String(f.name || `Founder ${i + 1}`).slice(0, 40),
    weight: Math.max(0, Number(f.weight) || 0),
  }));
  const weightSum = weights.reduce((s, f) => s + f.weight, 0) || 1;
  const founders = weights.map((f) => ({
    ...f,
    shares: issued * (f.weight / weightSum),
  }));

  const safes = (Array.isArray(raw.safes) ? raw.safes : []).map((s, i) => ({
    id: String(s.id || newId('safe', i)),
    name: String(s.name || `SAFE ${i + 1}`).slice(0, 40),
    amount: Math.max(0, Number(s.amount) || 0),
    type: s.type === 'pre' ? 'pre' : 'post',
    cap: s.cap == null || s.cap === '' ? null : Math.max(0, Number(s.cap) || 0),
    discount: clamp(s.discount ?? 0, 0, 0.5),
  })).filter((s) => s.amount > 0);

  const r = raw.round || {};
  const round = {
    enabled: Boolean(r.enabled),
    name: String(r.name || 'Seed').slice(0, 40),
    amount: Math.max(0, Number(r.amount) || 0),
    preMoney: Math.max(0, Number(r.preMoney) || 0),
    poolTarget: clamp(r.poolTarget ?? 0, 0, 0.4),
  };

  const g = raw.grant || {};
  const grantEnabled = Boolean(g.enabled);
  const grant = {
    enabled: grantEnabled,
    id: 'grant',
    name: String(g.name || 'Your grant').slice(0, 40),
    percentOfFd: clamp(g.percentOfFd ?? 0.002, 0, 0.2),
    vestMonths: Math.max(1, Math.round(Number(g.vestMonths) || 48)),
    cliffMonths: Math.max(0, Math.round(Number(g.cliffMonths) || 12)),
    leaveMonth: Math.max(0, Math.round(Number(g.leaveMonth) || 18)),
  };

  const exits = {
    conservative: Math.max(0, Number(raw.exits?.conservative) || 0),
    base: Math.max(0, Number(raw.exits?.base) || 0),
    breakout: Math.max(0, Number(raw.exits?.breakout) || 0),
  };

  const salaryGap = Math.max(0, Number(raw.salaryGap) || 0);
  const focusId = String(raw.focusId || founders[0]?.id || 'f-a');

  if (poolPct > 0.25) {
    warning(warnings, 'large-pool', 'An initial option pool above 25% is unusual at incorporation.');
  }

  return {
    poolPct,
    poolShares,
    founders,
    safes,
    round,
    grant,
    exits,
    salaryGap,
    focusId,
    warnings,
  };
}

function stakeholder(partial) {
  return {
    id: partial.id,
    name: partial.name,
    role: partial.role,
    issued: partial.issued || 0,
    unissued: partial.unissued || 0,
    get shares() { return this.issued + this.unissued; },
  };
}

function snapshot(label, key, people, extras = {}) {
  const totalFd = people.reduce((s, p) => s + p.shares, 0);
  const rows = people.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    issued: p.issued,
    unissued: p.unissued,
    shares: p.shares,
    percent: totalFd > 0 ? p.shares / totalFd : 0,
  }));
  return { label, key, totalFd, rows, ...extras };
}

function clonePeople(people) {
  return people.map((p) => stakeholder({
    id: p.id, name: p.name, role: p.role, issued: p.issued, unissued: p.unissued,
  }));
}

function find(people, id) {
  return people.find((p) => p.id === id);
}

/**
 * Convert SAFEs into shares against the current cap table.
 * `roundPrice` is the price per share of a priced round, if known.
 * When null, discount-only SAFEs cannot convert and are flagged.
 */
function convertSafes(people, safes, warnings, roundPrice) {
  const next = clonePeople(people);
  const preSafeFd = next.reduce((s, p) => s + p.shares, 0);

  const postSafes = safes.filter((s) => s.type === 'post');
  const preSafes = safes.filter((s) => s.type === 'pre');

  const postPercents = postSafes.map((s) => {
    if (s.cap && s.cap > 0) return { safe: s, pct: s.amount / s.cap };
    return { safe: s, pct: null };
  });
  const cappedSum = postPercents.reduce((s, r) => s + (r.pct || 0), 0);
  if (cappedSum >= 0.95) {
    warning(warnings, 'safe-oversub', 'Post-money SAFE caps stack to 95% or more of the company. Check the caps and amounts.');
  }
  const usablePost = Math.min(cappedSum, 0.95);
  const scale = cappedSum > 0 ? usablePost / cappedSum : 1;

  // Post-money SAFEs take a promised % of the post-conversion, pre-priced-round company.
  const postSharesTotal = preSafeFd * (usablePost / (1 - usablePost || 1));
  for (const row of postPercents) {
    let shares = 0;
    if (row.pct != null && cappedSum > 0) {
      shares = postSharesTotal * ((row.pct * scale) / usablePost);
    }
    // Discount may later add more shares once a round price is known.
    if (roundPrice && row.safe.discount > 0) {
      const discountPrice = roundPrice * (1 - row.safe.discount);
      const capPrice = shares > 0 ? row.safe.amount / shares : Infinity;
      const price = Math.min(capPrice, discountPrice);
      if (price > 0 && Number.isFinite(price)) {
        shares = row.safe.amount / price;
      }
    } else if (row.pct == null) {
      if (roundPrice && row.safe.discount > 0) {
        const discountPrice = roundPrice * (1 - row.safe.discount);
        if (discountPrice > 0) shares = row.safe.amount / discountPrice;
      } else {
        warning(warnings, 'safe-pending', `${row.safe.name} has no cap and no priced-round price, so it cannot convert yet.`);
      }
    }
    next.push(stakeholder({
      id: row.safe.id,
      name: row.safe.name,
      role: 'safe',
      issued: shares,
    }));
  }

  // Pre-money SAFEs convert simultaneously against the same pre-SAFE FD.
  for (const s of preSafes) {
    let shares = 0;
    if (s.cap && s.cap > 0) {
      const capPrice = s.cap / preSafeFd;
      let price = capPrice;
      if (roundPrice && s.discount > 0) {
        price = Math.min(capPrice, roundPrice * (1 - s.discount));
      }
      shares = price > 0 ? s.amount / price : 0;
    } else if (roundPrice && s.discount > 0) {
      const discountPrice = roundPrice * (1 - s.discount);
      shares = discountPrice > 0 ? s.amount / discountPrice : 0;
    } else {
      warning(warnings, 'safe-pending', `${s.name} has no cap and no priced-round price, so it cannot convert yet.`);
    }
    next.push(stakeholder({
      id: s.id,
      name: s.name,
      role: 'safe',
      issued: shares,
    }));
  }

  return next;
}

function applyPricedRound(people, round, warnings) {
  const next = clonePeople(people);
  if (!round.enabled || round.amount <= 0 || round.preMoney <= 0) {
    if (round.enabled && (round.amount <= 0 || round.preMoney <= 0)) {
      warning(warnings, 'round-incomplete', 'The priced round needs both new money and a pre-money valuation.');
    }
    return { people: next, price: null, addedPool: 0, investorShares: 0 };
  }

  const issued = next.reduce((s, p) => s + p.issued, 0);
  const pool = find(next, 'pool');
  const unissued = pool ? pool.unissued : 0;
  const investorPct = round.amount / (round.preMoney + round.amount);
  const target = round.poolTarget;

  let addedPool = 0;
  let postFd;
  let investorShares;

  if (target > 0 && investorPct + target >= 0.95) {
    warning(warnings, 'round-squeeze', 'New money plus the target option pool leaves almost nothing for existing holders.');
  }

  if (target > 0 && investorPct + target < 1) {
    // Unissued pool should be `target` of post-money FD, carved from pre-money.
    const existingIssuedPct = 1 - investorPct - target;
    postFd = issued / existingIssuedPct;
    const desiredPool = target * postFd;
    if (desiredPool > unissued) {
      addedPool = desiredPool - unissued;
      if (pool) pool.unissued = desiredPool;
    } else {
      // Pool already large enough — no shuffle. Recompute with existing pool.
      postFd = (issued + unissued) / (1 - investorPct);
      investorShares = investorPct * postFd;
      const price = investorShares > 0 ? round.amount / investorShares : null;
      next.push(stakeholder({
        id: 'investor',
        name: round.name + ' investors',
        role: 'investor',
        issued: investorShares,
      }));
      return { people: next, price, addedPool: 0, investorShares };
    }
    investorShares = investorPct * postFd;
  } else {
    const preFd = issued + unissued;
    postFd = preFd / (1 - investorPct);
    investorShares = investorPct * postFd;
  }

  const price = investorShares > 0 ? round.amount / investorShares : null;
  next.push(stakeholder({
    id: 'investor',
    name: round.name + ' investors',
    role: 'investor',
    issued: investorShares,
  }));
  return { people: next, price, addedPool, investorShares };
}

function applyGrant(people, grant, warnings) {
  const next = clonePeople(people);
  if (!grant.enabled || grant.percentOfFd <= 0) return { people: next, grantShares: 0, vested: 0 };

  const fd = next.reduce((s, p) => s + p.shares, 0);
  const grantShares = fd * grant.percentOfFd;
  const pool = find(next, 'pool');
  if (!pool || pool.unissued + 1e-9 < grantShares) {
    warning(warnings, 'grant-over-pool', 'The grant is larger than the remaining unissued option pool. The model still issues it, and flags the shortfall.');
    if (pool) pool.unissued = 0;
  } else {
    pool.unissued -= grantShares;
  }
  next.push(stakeholder({
    id: 'grant',
    name: grant.name,
    role: 'employee',
    issued: grantShares,
  }));
  const frac = vestedFraction(grant.leaveMonth, grant.vestMonths, grant.cliffMonths);
  return { people: next, grantShares, vested: grantShares * frac, fraction: frac };
}

function focusRow(snap, focusId) {
  return snap.rows.find((r) => r.id === focusId) || null;
}

export function breakEvenExit(ownershipPct, salaryGap) {
  if (!ownershipPct || ownershipPct <= 0) return null;
  if (!salaryGap || salaryGap <= 0) return null;
  return salaryGap / ownershipPct;
}

export function paperValue(ownershipPct, exitValue) {
  if (!ownershipPct || ownershipPct <= 0) return 0;
  return ownershipPct * exitValue;
}

/**
 * Project a model into staged cap tables and a focus summary.
 */
export function project(raw) {
  const model = normalizeModel(raw);
  const warnings = [...model.warnings];
  const stages = [];

  let people = [
    ...model.founders.map((f) => stakeholder({
      id: f.id, name: f.name, role: 'founder', issued: f.shares,
    })),
    stakeholder({ id: 'pool', name: 'Option pool (unissued)', role: 'pool', unissued: model.poolShares }),
  ];
  stages.push(snapshot('The garage', 'garage', people));

  // First pass: convert SAFEs without a round price, then a priced round, then
  // one iteration if a discount needs the round price.
  let afterSafes = model.safes.length
    ? convertSafes(people, model.safes, warnings, null)
    : clonePeople(people);
  if (model.safes.length) {
    stages.push(snapshot('After SAFEs', 'safes', afterSafes));
  }

  let priced = applyPricedRound(afterSafes, model.round, warnings);
  if (model.round.enabled && priced.price) {
    const hasDiscount = model.safes.some((s) => s.discount > 0);
    if (hasDiscount) {
      const iterated = convertSafes(people, model.safes, [], priced.price);
      priced = applyPricedRound(iterated, model.round, warnings);
      afterSafes = iterated;
      const safeStage = stages.find((s) => s.key === 'safes');
      if (safeStage) {
        const refreshed = snapshot('After SAFEs', 'safes', afterSafes);
        Object.assign(safeStage, refreshed);
      }
    }
  }

  if (model.round.enabled && model.round.amount > 0 && model.round.preMoney > 0) {
    if (priced.addedPool > 0) {
      // Show an intermediate stage with the pool bump but before new money
      // so the shuffle is visible. Reconstruct: take post-round people, drop investor, keep new pool.
      const mid = clonePeople(priced.people).filter((p) => p.role !== 'investor');
      stages.push(snapshot('Option-pool refresh', 'pool', mid, { addedPool: priced.addedPool }));
    }
    stages.push(snapshot(`After the ${model.round.name.toLowerCase()}`, 'round', priced.people, {
      price: priced.price,
      addedPool: priced.addedPool,
      investorShares: priced.investorShares,
    }));
    people = priced.people;
  } else {
    people = afterSafes;
  }

  let grantInfo = { grantShares: 0, vested: 0, fraction: 0 };
  if (model.grant.enabled) {
    const granted = applyGrant(people, model.grant, warnings);
    grantInfo = granted;
    people = granted.people;
    stages.push(snapshot('After the grant', 'grant', people, {
      grantShares: granted.grantShares,
      vested: granted.vested,
      vestFraction: granted.fraction,
    }));
  }

  const finalStage = stages[stages.length - 1];
  const focus = resolveFocus(model, stages, grantInfo, finalStage);

  const insights = buildInsights(model, stages, focus, warnings);

  return {
    model,
    stages,
    finalStage,
    focus,
    warnings,
    insights,
    grantInfo,
  };
}

function resolveFocus(model, stages, grantInfo, finalStage) {
  const focusId = model.focusId === 'grant' && model.grant.enabled
    ? 'grant'
    : (model.founders.some((f) => f.id === model.focusId) ? model.focusId : model.founders[0].id);

  const series = stages.map((s) => {
    const row = focusRow(s, focusId);
    return {
      key: s.key,
      label: s.label,
      percent: row ? row.percent : 0,
      shares: row ? row.shares : 0,
    };
  });

  const start = series[0]?.percent || 0;
  const end = series[series.length - 1]?.percent || 0;
  const endShares = series[series.length - 1]?.shares || 0;

  // If focus is the employee, "effective" ownership after leaving early uses vested shares / FD.
  let effectivePercent = end;
  let vestedShares = endShares;
  let forfeited = 0;
  if (focusId === 'grant' && model.grant.enabled) {
    vestedShares = grantInfo.vested;
    forfeited = Math.max(0, grantInfo.grantShares - grantInfo.vested);
    effectivePercent = finalStage.totalFd > 0 ? vestedShares / finalStage.totalFd : 0;
  }

  const values = {
    conservative: paperValue(effectivePercent, model.exits.conservative),
    base: paperValue(effectivePercent, model.exits.base),
    breakout: paperValue(effectivePercent, model.exits.breakout),
  };
  const beat = breakEvenExit(effectivePercent, model.salaryGap);

  const focusName = focusId === 'grant'
    ? model.grant.name
    : (model.founders.find((f) => f.id === focusId)?.name || 'Your slice');

  return {
    id: focusId,
    name: focusName,
    series,
    startPercent: start,
    endPercent: end,
    effectivePercent,
    endShares,
    vestedShares,
    forfeited,
    values,
    breakEven: beat,
    dilution: start - effectivePercent,
  };
}

function buildInsights(model, stages, focus, _warnings) {
  const notes = [];
  const garage = stages.find((s) => s.key === 'garage');
  const afterRound = stages.find((s) => s.key === 'round');
  const afterPool = stages.find((s) => s.key === 'pool');
  const afterSafes = stages.find((s) => s.key === 'safes');

  if (garage && afterRound) {
    const gRow = focusRow(garage, focus.id);
    const rRow = focusRow(afterRound, focus.id);
    if (gRow && rRow && focus.id !== 'grant') {
      const lost = gRow.percent - rRow.percent;
      notes.push({
        code: 'dilution-total',
        title: 'Total dilution to this point',
        body: `${focus.name} goes from ${pct(gRow.percent)} in the garage to ${pct(rRow.percent)} after the priced round — ${pct(lost)} given up across the raises.`,
      });
    }
  }

  if (afterPool && afterRound && afterSafes && focus.id !== 'grant') {
    const beforePool = focusRow(afterSafes, focus.id);
    const afterPoolRow = focusRow(afterPool, focus.id);
    const afterRoundRow = focusRow(afterRound, focus.id);
    if (beforePool && afterPoolRow && afterRoundRow) {
      const poolHit = beforePool.percent - afterPoolRow.percent;
      const raiseHit = afterPoolRow.percent - afterRoundRow.percent;
      if (poolHit > raiseHit && poolHit > 0.001) {
        notes.push({
          code: 'shuffle-hurts-more',
          title: 'The pool refresh took more than the new money',
          body: `The option-pool shuffle cut ${focus.name} by ${pct(poolHit)}. The new cash only cut another ${pct(raiseHit)}. That is the classic pre-money pool shuffle.`,
        });
      } else if (raiseHit > 0.001) {
        notes.push({
          code: 'raise-hurts-more',
          title: 'The new money was the bigger cut',
          body: `New investors cut ${focus.name} by ${pct(raiseHit)}. The pool refresh cut ${pct(poolHit)}.`,
        });
      }
    }
  }

  if (afterSafes && focus.id !== 'grant') {
    const safePct = afterSafes.rows.filter((r) => r.role === 'safe').reduce((s, r) => s + r.percent, 0);
    if (safePct > 0) {
      notes.push({
        code: 'safe-stack',
        title: 'SAFE conversion',
        body: `Converted SAFEs hold ${pct(safePct)} immediately after conversion, before any priced-round money or a new pool refresh.`,
      });
    }
  }

  if (focus.id === 'grant' && model.grant.enabled) {
    const g = model.grant;
    if (g.leaveMonth < g.cliffMonths) {
      notes.push({
        code: 'cliff-zero',
        title: 'Leaving before the cliff',
        body: `At ${g.leaveMonth} months, nothing has vested. The one-year cliff means the grant is forfeited.`,
      });
    } else if (g.leaveMonth < g.vestMonths) {
      notes.push({
        code: 'partial-vest',
        title: 'Leaving mid-vest',
        body: `At ${g.leaveMonth} of ${g.vestMonths} months, ${pct(vestedFractionSafe(g))} of the grant has vested. Unvested shares go back to the pool.`,
      });
    }
  }

  if (focus.breakEven) {
    notes.push({
      code: 'break-even',
      title: 'Exit that matches the cash you would give up',
      body: `With a ${pct(focus.effectivePercent)} slice, the company would need to be worth about ${money(focus.breakEven)} at exit (no preference, no taxes) to match a ${money(model.salaryGap)} four-year cash gap.`,
    });
  }

  return notes;
}

function vestedFractionSafe(g) {
  if (g.leaveMonth < g.cliffMonths) return 0;
  return Math.min(1, g.leaveMonth / g.vestMonths);
}

function pct(n) {
  return `${((n || 0) * 100).toFixed(2)}%`;
}

function money(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

/** Compare two models' focus slices — used by the live "what we tested" lab. */
export function compareFocus(rawA, rawB) {
  const a = project(rawA);
  const b = project(rawB);
  return {
    a: a.focus,
    b: b.focus,
    deltaPercent: b.focus.effectivePercent - a.focus.effectivePercent,
    deltaBase: b.focus.values.base - a.focus.values.base,
  };
}
