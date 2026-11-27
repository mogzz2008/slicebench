import assert from 'node:assert/strict';

export function approx(actual, expected, eps = 1e-6) {
  const a = Number(actual);
  const e = Number(expected);
  assert.ok(Number.isFinite(a), `actual is not finite: ${actual}`);
  assert.ok(Math.abs(a - e) <= eps * Math.max(1, Math.abs(e)), `expected ${e} ± ${eps}, got ${a}`);
}

export function pct(rowShare, total) {
  return total > 0 ? rowShare / total : 0;
}

export function row(stage, id) {
  const found = stage.rows.find((r) => r.id === id);
  assert.ok(found, `missing row ${id} in ${stage.key}`);
  return found;
}
