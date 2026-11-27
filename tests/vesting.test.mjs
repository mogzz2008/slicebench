import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { vestedFraction, vestedShares, forfeitShares } from '../public/js/core/vesting.js';
import { approx } from './helpers.mjs';

describe('vesting', () => {
  it('returns 0 before the cliff', () => {
    assert.equal(vestedFraction(0, 48, 12), 0);
    assert.equal(vestedFraction(11, 48, 12), 0);
  });

  it('vests monthly once the cliff is hit', () => {
    approx(vestedFraction(12, 48, 12), 12 / 48);
    approx(vestedFraction(18, 48, 12), 18 / 48);
    approx(vestedFraction(36, 48, 12), 0.75);
  });

  it('is fully vested at and after the vest period', () => {
    assert.equal(vestedFraction(48, 48, 12), 1);
    assert.equal(vestedFraction(60, 48, 12), 1);
  });

  it('splits a grant into vested and forfeited shares', () => {
    approx(vestedShares(1000, 18, 48, 12), 375);
    approx(forfeitShares(1000, 18, 48, 12), 625);
    assert.equal(vestedShares(1000, 6, 48, 12), 0);
    assert.equal(forfeitShares(1000, 6, 48, 12), 1000);
  });

  it('treats invalid inputs as zero', () => {
    assert.equal(vestedFraction(-3, 48, 12), 0);
    assert.equal(vestedFraction(18, 0, 12), 0);
    assert.equal(vestedFraction(Number.NaN, 48, 12), 0);
  });
});
