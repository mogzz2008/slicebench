import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { featuredLabStory, LAB_DEFAULT_HEADING, LAB_DEFAULT_LEAD } from '../public/js/core/labstory.js';

describe('featuredLabStory', () => {
  it('keeps the default lab heading when there is no vesting insight', () => {
    const story = featuredLabStory([
      { code: 'shuffle-hurts-more', title: 'The pool refresh took more than the new money', body: 'x' },
    ]);
    assert.equal(story.heading, LAB_DEFAULT_HEADING);
    assert.equal(story.lead, LAB_DEFAULT_LEAD);
    assert.equal(story.featured, null);
  });

  it('promotes the cliff insight to the lab heading', () => {
    const story = featuredLabStory([
      { code: 'dilution-total', title: 'Total dilution to this point', body: 'x' },
      { code: 'cliff-zero', title: 'Leaving before the cliff', body: 'At 8 months, nothing has vested.' },
    ]);
    assert.equal(story.heading, 'Leaving before the cliff');
    assert.equal(story.lead, 'At 8 months, nothing has vested.');
    assert.equal(story.featured.code, 'cliff-zero');
  });

  it('promotes a mid-vest insight to the lab heading', () => {
    const story = featuredLabStory([
      { code: 'partial-vest', title: 'Leaving mid-vest', body: 'At 18 of 48 months, 37.50% of the grant has vested.' },
    ]);
    assert.equal(story.heading, 'Leaving mid-vest');
  });
});
