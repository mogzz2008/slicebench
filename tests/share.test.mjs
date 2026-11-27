import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState, applyHash, shareUrl, toState } from '../public/js/core/share.js';
import { defaultModel, getPreset } from '../public/js/core/presets.js';

describe('share encoding', () => {
  it('round-trips the default model', () => {
    const model = defaultModel();
    const decoded = decodeState(encodeState(model));
    assert.deepEqual(toState(decoded), toState(model));
  });

  it('round-trips the employee preset, including the grant', () => {
    const model = getPreset('employee').model;
    const decoded = decodeState(encodeState(model));
    assert.equal(decoded.grant.enabled, true);
    assert.equal(decoded.focusId, 'grant');
    assert.equal(decoded.grant.leaveMonth, 18);
    assert.equal(decoded.safes[0].amount, 500_000);
  });

  it('returns null for garbage hashes', () => {
    assert.equal(decodeState(''), null);
    assert.equal(decodeState('not-valid'), null);
    assert.equal(decodeState('#$$$'), null);
  });

  it('falls back when the hash is empty', () => {
    const fallback = defaultModel();
    assert.equal(applyHash('', fallback), fallback);
    assert.equal(applyHash('#', fallback), fallback);
  });

  it('builds a share URL with a hash payload', () => {
    const url = shareUrl(defaultModel(), 'https://mogzz2008.github.io/slicebench/');
    assert.match(url, /^https:\/\/mogzz2008\.github\.io\/slicebench\/#/);
    const hash = url.split('#')[1];
    const decoded = decodeState(hash);
    assert.equal(decoded.focusId, 'f-a');
    assert.equal(decoded.round.amount, 3_500_000);
  });
});
