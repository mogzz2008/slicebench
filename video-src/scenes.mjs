// Narrated demo script. Each scene is a list of voice segments; `act` runs when that segment starts.
export const VOICE = 'en-US-AndrewNeural';
export const RATE = '+8%';

export const scenes = [
  {
    id: 'title',
    segs: [
      {
        text: 'Slicebench.',
        act: (h) => h.titleCard(),
      },
      {
        text: "See what's left after the next two rounds.",
        act: (h) => h.caption("See what's left after the next two rounds."),
      },
    ],
  },
  {
    id: 'hook',
    segs: [
      {
        text: 'In the garage, Founder A owns forty-five percent.',
        act: async (h) => {
          await h.caption('In the garage · Founder A · 45.00%');
          await h.hideTitle();
          await h.scrollTo('.hero', 0, 350);
          await h.hover('[data-testid="hero-from"]');
        },
      },
      {
        text: 'After a YC SAFE and a seed, that same person keeps thirty-four point eight five percent.',
        act: async (h) => {
          await h.caption('After the seed · Founder A · 34.85%');
          await h.waitForText('[data-testid="hero-to"]', '34.85%');
          await h.hover('[data-testid="hero-to"]');
        },
      },
      {
        text: 'A fifty-fifty split is not what you own after the next two rounds.',
        act: (h) => h.caption('45.00% → 34.85% after two raises'),
      },
    ],
  },
  {
    id: 'product',
    segs: [
      {
        text: 'Slicebench is a cap-table workbench. Post-money SAFEs, the option-pool shuffle, and vesting, all in your browser.',
        act: async (h) => {
          await h.caption('SAFE + pool shuffle + vesting, in your browser');
          await h.scrollTo('#workspace', 0, 800);
          await h.hover('[data-testid="slice-percent"]');
        },
      },
      {
        text: 'The slice, the ownership stack, and the paper values all move together. At a one hundred fifty million dollar exit, this slice is worth fifty-two point two seven million on paper.',
        act: async (h) => {
          await h.caption('Base exit $150M → paper value $52.27M');
          await h.eval(() => document.querySelector('[data-testid="paper-base"]')?.scrollIntoView({ block: 'center' }));
          await h.sleep(350);
          await h.waitForText('[data-testid="paper-base"]', '52.27');
          await h.hover('[data-testid="paper-base"]');
        },
      },
    ],
  },
  {
    id: 'shuffle',
    segs: [
      {
        text: 'Now the messy term sheet. Four founders, and a seed that demands a twenty percent option pool.',
        act: async (h) => {
          await h.caption('Four founders, and a seed that demands a 20% option pool');
          await h.scrollTo('.presets', -72, 500);
          await h.click('[data-testid="preset-shuffle"]');
          await h.waitForSlice('20.86');
          await h.caption('Maya · 38.00% in the garage → 20.86% after the seed');
          await h.scrollTo('#workspace', 0, 700);
        },
      },
      {
        text: 'The pool refresh cut Maya more than the new money did. That is the option-pool shuffle.',
        act: async (h) => {
          await h.caption('The pool refresh took more than the new money');
          await h.eval(() => document.querySelector('[data-testid="insight-shuffle-hurts-more"]')?.scrollIntoView({ block: 'center' }));
          await h.sleep(280);
          await h.waitForText('[data-testid="insight-shuffle-hurts-more"]', 'The pool refresh took more than the new money');
          await h.hover('[data-testid="insight-shuffle-hurts-more"]');
        },
      },
    ],
  },
  {
    id: 'lab',
    segs: [
      {
        text: 'Before we shipped, we tested two edits on this same deal: raise the pool five more points, or raise two million more in cash.',
        act: async (h) => {
          await h.caption('What we tested: pool +5 points, or raise $2M more');
          await h.eval(() => document.querySelector('[data-testid="lab"]')?.scrollIntoView({ block: 'center' }));
          await h.sleep(350);
          await h.hover('[data-testid="lab-pool-delta"]');
        },
      },
      {
        text: 'The lab updates live. Apply one, and the bench moves with it.',
        act: async (h) => {
          await h.caption('Apply the experiment — the slice updates live');
          await h.click('[data-testid="lab-apply-pool"]');
          await h.waitForText('[data-testid="slice-name"]', 'Maya');
          await h.eval(() => document.querySelector('[data-testid="slice-percent"]')?.scrollIntoView({ block: 'center' }));
          await h.sleep(280);
          await h.hover('[data-testid="slice-percent"]');
        },
      },
    ],
  },
  {
    id: 'employee',
    segs: [
      {
        text: 'If you are joining, not founding, load the employee preset.',
        act: async (h) => {
          await h.caption('If you are joining, not founding');
          await h.scrollTo('.presets', -72, 500);
          await h.click('[data-testid="preset-employee"]');
          await h.waitForSlice('0.08');
          await h.caption('Your grant · 0.20% issued · 0.08% vested at month 18');
          await h.scrollTo('#workspace', 0, 700);
        },
      },
      {
        text: 'A two-tenths of a percent grant, four-year vest, one-year cliff. Leave at month eighteen, and only zero point zero eight percent is still yours.',
        act: async (h) => {
          await h.caption('Leave at month 18 · 18 of 48 months vested');
          await h.waitForSlice('0.08');
          await h.hover('[data-testid="slice-percent"]');
        },
      },
      {
        text: 'Leave before the cliff, and the grant goes to zero.',
        act: async (h) => {
          await h.caption('Leave at month 8 · 0.00% vested');
          await h.eval(() => document.querySelector('[data-testid="field-leave"]')?.scrollIntoView({ block: 'center' }));
          await h.sleep(200);
          await h.type('[data-testid="field-leave"]', '8', 90);
          await h.eval(() => document.activeElement?.blur());
          await h.waitForSlice('0.00');
        },
      },
    ],
  },
  {
    id: 'trust',
    segs: [
      {
        text: 'The method is on the table: YC post-money SAFEs, the option-pool shuffle, and standard vesting.',
        act: async (h) => {
          await h.caption('YC SAFEs · pool shuffle · standard vesting');
          await h.click('[data-testid="sources-open"]');
          await h.sleep(450);
        },
      },
      {
        text: 'Nothing is uploaded. Copy a share link, download the numbers, or print a one-pager.',
        act: async (h) => {
          await h.click('[data-testid="sources-close"]');
          await h.sleep(200);
          await h.caption('Private by design. No account. No server.');
          await h.scrollTo('.bench-head', -8, 700);
          await h.hover('[data-testid="share-copy"]');
        },
      },
    ],
  },
  {
    id: 'end',
    segs: [
      {
        text: "Slicebench. See what's left, before you sign.",
        act: (h) => h.endCard(),
      },
    ],
  },
];
