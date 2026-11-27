import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatPercent, formatMoney } from '../public/js/core/format.js';

describe('formatPercent', () => {
  it('rounds 0.075% half-up to 0.08%', () => {
    assert.equal(formatPercent(0.00075, 2), '0.08%');
    assert.equal(formatPercent(0.002 * (18 / 48), 2), '0.08%');
  });

  it('keeps known cap-table percentages stable', () => {
    assert.equal(formatPercent(0.45, 2), '45.00%');
    assert.equal(formatPercent(0.34849989207856685, 2), '34.85%');
    assert.equal(formatPercent(0.20862745, 2), '20.86%');
    assert.equal(formatPercent(0.002, 2), '0.20%');
  });
});

describe('formatMoney', () => {
  it('compacts the YC paper values the UI shows', () => {
    assert.equal(formatMoney(52274983.81178503), '$52.27M');
    assert.equal(formatMoney(13939995.683142673), '$13.94M');
  });
});
