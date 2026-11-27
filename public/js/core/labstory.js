/** Heading and lead copy for the lab panel, driven by the live insight set. */

export const LAB_DEFAULT_HEADING = 'What we tested';
export const LAB_DEFAULT_LEAD = 'Two edits we ran on this same deal, live. They do not change your bench until you apply one.';

const FEATURED_CODES = new Set(['cliff-zero', 'partial-vest']);

export function featuredLabStory(insights) {
  const featured = (insights || []).find((item) => FEATURED_CODES.has(item.code));
  if (!featured) {
    return { heading: LAB_DEFAULT_HEADING, lead: LAB_DEFAULT_LEAD, featured: null };
  }
  return { heading: featured.title, lead: featured.body, featured };
}
