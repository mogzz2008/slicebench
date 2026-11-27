/** One-click judge presets. Each one is a complete, editable model. */

export const PRESETS = {
  yc: {
    id: 'yc',
    label: 'Two founders, YC batch',
    blurb: '50/50 split, a $500k post-money SAFE at a $12.5M cap, then a $3.5M seed at $17M pre with a 10% post-money pool refresh.',
    model: {
      founders: [
        { id: 'f-a', name: 'Founder A', weight: 50 },
        { id: 'f-b', name: 'Founder B', weight: 50 },
      ],
      poolPct: 0.10,
      safes: [
        { id: 'safe-yc', name: 'YC SAFE', amount: 500_000, type: 'post', cap: 12_500_000, discount: 0 },
      ],
      round: { enabled: true, name: 'Seed', amount: 3_500_000, preMoney: 17_000_000, poolTarget: 0.10 },
      grant: { enabled: false, name: 'First engineer', percentOfFd: 0.005, vestMonths: 48, cliffMonths: 12, leaveMonth: 18 },
      exits: { conservative: 40_000_000, base: 150_000_000, breakout: 800_000_000 },
      salaryGap: 400_000,
      focusId: 'f-a',
    },
  },
  shuffle: {
    id: 'shuffle',
    label: 'The option-pool shuffle',
    blurb: 'Four founders, a $1M SAFE, and a seed that demands a 20% post-money pool. Watch the refresh take a bigger bite than the new cash.',
    model: {
      founders: [
        { id: 'f-a', name: 'Maya (CEO)', weight: 40 },
        { id: 'f-b', name: 'Luis (CTO)', weight: 30 },
        { id: 'f-c', name: 'Priya (product)', weight: 20 },
        { id: 'f-d', name: 'Jordan (design)', weight: 10 },
      ],
      poolPct: 0.05,
      safes: [
        { id: 'safe-ff', name: 'Friends & family SAFE', amount: 1_000_000, type: 'post', cap: 8_000_000, discount: 0 },
      ],
      round: { enabled: true, name: 'Seed', amount: 4_000_000, preMoney: 16_000_000, poolTarget: 0.20 },
      grant: { enabled: false, name: 'First engineer', percentOfFd: 0.005, vestMonths: 48, cliffMonths: 12, leaveMonth: 18 },
      exits: { conservative: 25_000_000, base: 100_000_000, breakout: 500_000_000 },
      salaryGap: 320_000,
      focusId: 'f-a',
    },
  },
  employee: {
    id: 'employee',
    label: 'Employee, leave at 18 months',
    blurb: 'A 0.20% grant after the seed, four-year vest, one-year cliff. See what is still yours if you walk at month 18.',
    model: {
      founders: [
        { id: 'f-a', name: 'Founder A', weight: 50 },
        { id: 'f-b', name: 'Founder B', weight: 50 },
      ],
      poolPct: 0.10,
      safes: [
        { id: 'safe-yc', name: 'YC SAFE', amount: 500_000, type: 'post', cap: 10_000_000, discount: 0 },
      ],
      round: { enabled: true, name: 'Seed', amount: 3_000_000, preMoney: 15_000_000, poolTarget: 0.10 },
      grant: { enabled: true, name: 'Your grant', percentOfFd: 0.002, vestMonths: 48, cliffMonths: 12, leaveMonth: 18 },
      exits: { conservative: 80_000_000, base: 250_000_000, breakout: 1_000_000_000 },
      salaryGap: 180_000,
      focusId: 'grant',
    },
  },
};

export const DEFAULT_PRESET_ID = 'yc';

export function getPreset(id) {
  return PRESETS[id] || PRESETS[DEFAULT_PRESET_ID];
}

export function defaultModel() {
  return structuredClone(PRESETS[DEFAULT_PRESET_ID].model);
}

/** Lab experiments used by the "what we tested" panel. They never mutate the input. */
export function labVariants(model) {
  const biggerPool = structuredClone(model);
  if (!biggerPool.round) biggerPool.round = { enabled: true, name: 'Seed', amount: 3_500_000, preMoney: 17_000_000, poolTarget: 0.10 };
  biggerPool.round.enabled = true;
  biggerPool.round.poolTarget = Math.min(0.25, (Number(biggerPool.round.poolTarget) || 0) + 0.05);

  const biggerRaise = structuredClone(model);
  if (!biggerRaise.round) biggerRaise.round = { enabled: true, name: 'Seed', amount: 3_500_000, preMoney: 17_000_000, poolTarget: 0.10 };
  biggerRaise.round.enabled = true;
  biggerRaise.round.amount = (Number(biggerRaise.round.amount) || 0) + 2_000_000;

  return {
    pool: {
      id: 'pool',
      label: 'Pool +5 points',
      hint: 'Same raise, option pool target raised by five percentage points.',
      model: biggerPool,
    },
    raise: {
      id: 'raise',
      label: 'Raise $2M more',
      hint: 'Same pre-money, two million more in new cash — a tighter round for existing holders.',
      model: biggerRaise,
    },
  };
}
