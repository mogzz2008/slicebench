/** Encode and restore a Slicebench model in the URL hash. */

const VERSION = 1;

export function toState(model) {
  return {
    v: VERSION,
    founders: (model.founders || []).map((f) => ({
      id: f.id,
      name: f.name,
      weight: f.weight,
    })),
    poolPct: model.poolPct,
    safes: (model.safes || []).map((s) => ({
      id: s.id,
      name: s.name,
      amount: s.amount,
      type: s.type,
      cap: s.cap,
      discount: s.discount,
    })),
    round: model.round ? { ...model.round } : undefined,
    grant: model.grant ? { ...model.grant } : undefined,
    exits: model.exits ? { ...model.exits } : undefined,
    salaryGap: model.salaryGap,
    focusId: model.focusId,
  };
}

export function encodeState(model) {
  const json = JSON.stringify(toState(model));
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return b64;
}

export function decodeState(hash) {
  if (!hash) return null;
  const raw = String(hash).replace(/^#/, '').trim();
  if (!raw) return null;
  try {
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((raw.length + 3) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);
    if (!data || data.v !== VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function applyHash(hash, fallback) {
  return decodeState(hash) || fallback;
}

export function shareUrl(model, base = (typeof location !== 'undefined' ? location.origin + location.pathname : 'https://mogzz2008.github.io/slicebench/')) {
  const url = base.endsWith('/') || base.endsWith('.html') ? base : `${base}/`;
  return `${url}#${encodeState(model)}`;
}
