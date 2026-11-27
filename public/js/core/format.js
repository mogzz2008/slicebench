/** Formatting helpers shared by the UI and tests. */

export function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

export function formatMoney(n, { digits = 2, compact = true } = {}) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  const sign = x < 0 ? '-' : '';
  const a = Math.abs(x);
  if (compact) {
    if (a >= 1e9) return `${sign}$${trimZeros((a / 1e9).toFixed(digits))}B`;
    if (a >= 1e6) return `${sign}$${trimZeros((a / 1e6).toFixed(digits))}M`;
    if (a >= 1e4) return `${sign}$${trimZeros((a / 1e3).toFixed(digits))}K`;
  }
  return `${sign}$${Math.round(a).toLocaleString('en-US')}`;
}

export function formatPercent(fraction, digits = 2) {
  const x = Number(fraction);
  if (!Number.isFinite(x)) return '—';
  // Add a tiny epsilon so values like 0.075, which are not exact in IEEE
  // floats, still round half-up the way a person would expect (0.08%).
  const factor = 10 ** digits;
  const rounded = Math.round(x * 100 * factor + 1e-9) / factor;
  return `${rounded.toFixed(digits)}%`;
}

export function formatShares(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return Math.round(x).toLocaleString('en-US');
}

export function formatMonths(n) {
  const x = Math.round(Number(n) || 0);
  if (x === 1) return '1 month';
  return `${x} months`;
}

function trimZeros(s) {
  return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}
