import { project, compareFocus } from './core/captable.js';
import { defaultModel, getPreset, labVariants, DEFAULT_PRESET_ID } from './core/presets.js';
import { applyHash, encodeState, shareUrl, toState } from './core/share.js';
import { formatMoney, formatPercent, formatShares } from './core/format.js';
import { featuredLabStory } from './core/labstory.js';
import { loadMutePreference, setMuted, isMuted, blip, whoosh, chime, tick, warn } from './audio.js';

const ROLE_COLOR = {
  founder: 'var(--founder)',
  pool: 'var(--pool)',
  safe: 'var(--safe)',
  investor: 'var(--investor)',
  employee: 'var(--employee)',
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let state = defaultModel();
let lastTick = 0;

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function animateNumber(el, next, format, duration = 520) {
  const prev = Number(el.dataset.value || 0);
  el.dataset.value = String(next);
  if (reducedMotion() || !Number.isFinite(prev) || !Number.isFinite(next)) {
    el.textContent = format(next);
    return;
  }
  const start = performance.now();
  const span = next - prev;
  const step = (t) => {
    const u = Math.min(1, (t - start) / duration);
    const eased = 1 - (1 - u) ** 3;
    el.textContent = format(prev + span * eased);
    if (u < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function pctFormat(n) { return formatPercent(n, 2); }

function syncMuteButton() {
  const btn = $('#mute-toggle');
  const muted = isMuted();
  btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  btn.querySelector('.mute-label').textContent = muted ? 'Sound off' : 'Sound on';
}

function setPresetActive(id) {
  $$('.preset-chip').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.preset === id);
  });
  const preset = getPreset(id === 'custom' ? DEFAULT_PRESET_ID : id);
  $('[data-testid="preset-blurb"]').textContent = id === 'custom'
    ? 'Custom deal — every lever is live. Copy a share link when you want to keep it.'
    : preset.blurb;
}

function hydrateFromState() {
  $('#field-pool').value = String((state.poolPct ?? 0.1) * 100);
  $('#round-enabled').checked = Boolean(state.round?.enabled);
  $('#field-round-name').value = state.round?.name || 'Seed';
  $('#field-round-amount').value = String(state.round?.amount ?? 0);
  $('#field-round-pre').value = String(state.round?.preMoney ?? 0);
  $('#field-pool-target').value = String((state.round?.poolTarget ?? 0) * 100);
  $('#grant-enabled').checked = Boolean(state.grant?.enabled);
  $('#field-grant-name').value = state.grant?.name || 'Your grant';
  $('#field-grant-pct').value = String(((state.grant?.percentOfFd ?? 0.002) * 100).toFixed(2));
  $('#field-vest').value = String(state.grant?.vestMonths ?? 48);
  $('#field-cliff').value = String(state.grant?.cliffMonths ?? 12);
  $('#field-leave').value = String(state.grant?.leaveMonth ?? 18);
  $('#field-exit-conservative').value = String(state.exits?.conservative ?? 0);
  $('#field-exit-base').value = String(state.exits?.base ?? 0);
  $('#field-exit-breakout').value = String(state.exits?.breakout ?? 0);
  $('#field-salary').value = String(state.salaryGap ?? 0);
  renderPeople();
  renderSafes();
  toggleSections();
  const grantRadio = $('#focus-grant');
  if (grantRadio) grantRadio.checked = state.focusId === 'grant';
}

function renderPeople() {
  const root = $('#founder-list');
  root.innerHTML = '';
  for (const f of state.founders) {
    const row = document.createElement('div');
    row.className = 'founder-row';
    row.dataset.id = f.id;
    row.innerHTML = `
      <input type="radio" class="focus-dot" name="focus" value="${f.id}" data-testid="focus-${f.id}" ${state.focusId === f.id ? 'checked' : ''} aria-label="Track ${escapeHtml(f.name)}">
      <input type="text" data-role="name" data-testid="founder-name-${f.id}" maxlength="40" value="${escapeAttr(f.name)}" aria-label="Founder name">
      <input type="number" data-role="weight" data-testid="founder-weight-${f.id}" min="0" step="1" value="${f.weight}" aria-label="Weight for ${escapeAttr(f.name)}">
      <div class="row-actions">
        <button type="button" class="mini-btn" data-role="remove" data-testid="remove-founder-${f.id}" ${state.founders.length < 2 ? 'disabled' : ''}>Remove</button>
      </div>`;
    root.appendChild(row);
  }
}

function renderSafes() {
  const root = $('#safe-list');
  root.innerHTML = '';
  if (!state.safes.length) {
    root.innerHTML = '<p class="hint">No SAFEs yet. Add one to model a pre-seed convertible.</p>';
    return;
  }
  for (const s of state.safes) {
    const card = document.createElement('div');
    card.className = 'safe-card';
    card.dataset.id = s.id;
    card.innerHTML = `
      <label class="field"><span>Name</span><input type="text" data-role="name" data-testid="safe-name-${s.id}" maxlength="40" value="${escapeAttr(s.name)}"></label>
      <label class="field"><span>Amount ($)</span><input type="number" data-role="amount" data-testid="safe-amount-${s.id}" min="0" step="10000" value="${s.amount}"></label>
      <label class="field"><span>Cap ($)</span><input type="number" data-role="cap" data-testid="safe-cap-${s.id}" min="0" step="100000" value="${s.cap ?? ''}" placeholder="Uncapped"></label>
      <label class="field"><span>Discount (%)</span><input type="number" data-role="discount" data-testid="safe-discount-${s.id}" min="0" max="50" step="1" value="${Math.round((s.discount || 0) * 100)}"></label>
      <label class="field"><span>Type</span>
        <select data-role="type" data-testid="safe-type-${s.id}">
          <option value="post" ${s.type !== 'pre' ? 'selected' : ''}>Post-money</option>
          <option value="pre" ${s.type === 'pre' ? 'selected' : ''}>Pre-money</option>
        </select>
      </label>
      <div class="field span-2 row-actions">
        <button type="button" class="mini-btn" data-role="remove" data-testid="remove-safe-${s.id}">Remove SAFE</button>
      </div>`;
    root.appendChild(card);
  }
}

function toggleSections() {
  const roundOn = $('#round-enabled').checked;
  const grantOn = $('#grant-enabled').checked;
  $('#round-fields').hidden = !roundOn;
  $('#grant-fields').hidden = !grantOn;
}

function readFormIntoState() {
  state.poolPct = Number($('#field-pool').value) / 100;
  state.round = {
    enabled: $('#round-enabled').checked,
    name: $('#field-round-name').value.trim() || 'Seed',
    amount: Number($('#field-round-amount').value) || 0,
    preMoney: Number($('#field-round-pre').value) || 0,
    poolTarget: Number($('#field-pool-target').value) / 100,
  };
  state.grant = {
    ...(state.grant || {}),
    enabled: $('#grant-enabled').checked,
    name: $('#field-grant-name').value.trim() || 'Your grant',
    percentOfFd: (Number($('#field-grant-pct').value) || 0) / 100,
    vestMonths: Number($('#field-vest').value) || 48,
    cliffMonths: Number($('#field-cliff').value) || 12,
    leaveMonth: Number($('#field-leave').value) || 0,
  };
  state.exits = {
    conservative: Number($('#field-exit-conservative').value) || 0,
    base: Number($('#field-exit-base').value) || 0,
    breakout: Number($('#field-exit-breakout').value) || 0,
  };
  state.salaryGap = Number($('#field-salary').value) || 0;

  state.founders = $$('#founder-list .founder-row').map((row, i) => ({
    id: row.dataset.id,
    name: $('[data-role="name"]', row).value.trim() || `Founder ${i + 1}`,
    weight: Number($('[data-role="weight"]', row).value) || 0,
  }));
  const checked = $('input[name="focus"]:checked');
  if (checked) state.focusId = checked.value;
  if (state.grant.enabled && state.focusId === 'grant') {
    /* keep */
  } else if (!state.founders.some((f) => f.id === state.focusId)) {
    state.focusId = state.founders[0]?.id || 'f-a';
  }

  state.safes = $$('#safe-list .safe-card').map((card, i) => {
    const capRaw = $('[data-role="cap"]', card).value;
    return {
      id: card.dataset.id,
      name: $('[data-role="name"]', card).value.trim() || `SAFE ${i + 1}`,
      amount: Number($('[data-role="amount"]', card).value) || 0,
      cap: capRaw === '' ? null : Number(capRaw) || 0,
      discount: (Number($('[data-role="discount"]', card).value) || 0) / 100,
      type: $('[data-role="type"]', card).value === 'pre' ? 'pre' : 'post',
    };
  });
}

function render(projection, { sound = false } = {}) {
  const { focus, finalStage, warnings, insights, model } = projection;
  const first = focus.series[0];
  const last = focus.series[focus.series.length - 1];

  animateNumber($('[data-testid="hero-from"]'), first?.percent || 0, pctFormat);
  animateNumber($('[data-testid="hero-to"]'), focus.effectivePercent, pctFormat);
  animateNumber($('[data-testid="hero-dial-pct"]'), focus.effectivePercent, pctFormat);
  const deg = Math.max(0, Math.min(360, focus.effectivePercent * 360));
  $('#hero-ring').style.background = `conic-gradient(var(--copper) 0 ${deg}deg, rgba(243, 234, 216, 0.08) 0 360deg)`;

  const footnoteBits = [];
  if (focus.id === 'grant') {
    footnoteBits.push(`${focus.name} is ${pctFormat(focus.endPercent)} on paper, and ${pctFormat(focus.effectivePercent)} after vesting at month ${model.grant.leaveMonth}.`);
  } else {
    footnoteBits.push(`${focus.name} goes from ${pctFormat(focus.startPercent)} in the garage to ${pctFormat(focus.effectivePercent)} after the last step.`);
  }
  const headline = insights.find((i) => i.code === 'shuffle-hurts-more' || i.code === 'raise-hurts-more' || i.code === 'cliff-zero' || i.code === 'partial-vest');
  if (headline) footnoteBits.push(headline.title + '.');
  $('[data-testid="hero-footnote"]').textContent = footnoteBits.join(' ');
  const fromSub = $('[data-testid="hero-from-sub"]');
  if (fromSub) fromSub.textContent = `${focus.name}, fully diluted`;
  const toSub = $('[data-testid="hero-to-sub"]');
  if (toSub) toSub.textContent = `${focus.name}, after the last step`;
  const toKicker = $('[data-testid="hero-to-kicker"]');
  if (toKicker) toKicker.textContent = last?.label || 'After the last step';

  $('[data-testid="slice-name"]').textContent = focus.name;
  animateNumber($('[data-testid="slice-percent"]'), focus.effectivePercent, pctFormat, 640);
  $('[data-testid="slice-sub"]').textContent = focus.id === 'grant'
    ? `vested if you leave at month ${model.grant.leaveMonth} (${formatShares(focus.vestedShares)} of ${formatShares(focus.endShares)} shares)`
    : 'of the company after the last step, fully diluted';

  const path = $('[data-testid="slice-path"]');
  path.innerHTML = focus.series.map((s, i) => {
    const shown = (focus.id === 'grant' && s.key === 'grant') ? focus.effectivePercent : s.percent;
    return `<span class="path-chip" style="animation-delay:${i * 40}ms">${escapeHtml(s.label)}<strong>${pctFormat(shown)}</strong></span>`;
  }).join('');

  const stack = $('[data-testid="stack"]');
  const legend = $('[data-testid="stack-legend"]');
  stack.innerHTML = '';
  legend.innerHTML = '';
  for (const r of finalStage.rows) {
    if (r.percent <= 0) continue;
    const bar = document.createElement('span');
    bar.style.width = `${(r.percent * 100).toFixed(4)}%`;
    bar.style.background = ROLE_COLOR[r.role] || 'var(--paper-dim)';
    bar.title = `${r.name} ${pctFormat(r.percent)}`;
    stack.appendChild(bar);
    const item = document.createElement('span');
    item.innerHTML = `<i class="swatch" style="background:${ROLE_COLOR[r.role] || 'var(--paper-dim)'}"></i>${escapeHtml(r.name)} ${pctFormat(r.percent)}`;
    legend.appendChild(item);
  }

  const tbody = $('[data-testid="cap-table"] tbody');
  tbody.innerHTML = finalStage.rows.map((r) => `
    <tr class="${r.id === focus.id ? 'is-focus' : ''}" data-testid="row-${r.id}">
      <td>${escapeHtml(r.name)}</td>
      <td class="role-tag">${escapeHtml(r.role)}</td>
      <td>${formatShares(r.shares)}</td>
      <td>${pctFormat(r.percent)}</td>
    </tr>`).join('');

  animateNumber($('[data-testid="paper-conservative"]'), focus.values.conservative, (n) => formatMoney(n));
  animateNumber($('[data-testid="paper-base"]'), focus.values.base, (n) => formatMoney(n));
  animateNumber($('[data-testid="paper-breakout"]'), focus.values.breakout, (n) => formatMoney(n));
  const exits = model.exits || {};
  const label = (name, value) => `${name} · ${formatMoney(value)} exit`;
  $('[data-testid="exit-label-conservative"]').textContent = label('Conservative', exits.conservative);
  $('[data-testid="exit-label-base"]').textContent = label('Base', exits.base);
  $('[data-testid="exit-label-breakout"]').textContent = label('Breakout', exits.breakout);

  const be = $('[data-testid="break-even"]');
  if (focus.breakEven) {
    be.textContent = `To match a ${formatMoney(model.salaryGap, { compact: true })} four-year cash gap, this ${pctFormat(focus.effectivePercent)} slice needs the company to be worth about ${formatMoney(focus.breakEven, { compact: true })} at exit — no preferences, no taxes.`;
  } else {
    be.textContent = 'Add a four-year cash gap to see the exit that would match the job you did not take.';
  }

  const warnBox = $('[data-testid="warnings"]');
  if (warnings.length) {
    warnBox.hidden = false;
    warnBox.innerHTML = warnings.map((w) => `<p>${escapeHtml(w.message)}</p>`).join('');
    if (sound) warn();
  } else {
    warnBox.hidden = true;
    warnBox.innerHTML = '';
  }

  const list = $('[data-testid="insights"]');
  list.innerHTML = insights.map((i) => `<li data-testid="insight-${i.code}"><strong>${escapeHtml(i.title)}</strong>${escapeHtml(i.body)}</li>`).join('');
  const story = featuredLabStory(insights);
  $('[data-testid="lab-heading"]').textContent = story.heading;
  $('[data-testid="lab-lead"]').textContent = story.lead;
  $('#lab').classList.toggle('is-featured-story', Boolean(story.featured));

  renderLab();
  $('#field-pool-out').textContent = `${Number($('#field-pool').value).toFixed(1).replace(/\.0$/, '')}%`;
  $('#field-pool-target-out').textContent = `${Number($('#field-pool-target').value).toFixed(1).replace(/\.0$/, '')}%`;

  try {
    const hash = encodeState(state);
    if (location.hash.replace(/^#/, '') !== hash) history.replaceState(null, '', `#${hash}`);
  } catch { /* ignore */ }

}

function renderLab() {
  const variants = labVariants(state);
  const pool = compareFocus(state, variants.pool.model);
  const raise = compareFocus(state, variants.raise.model);
  paintLab('lab-pool', pool, variants.pool);
  paintLab('lab-raise', raise, variants.raise);
}

function paintLab(prefix, cmp, variant) {
  const deltaEl = $(`[data-testid="${prefix}-delta"]`);
  const pts = cmp.deltaPercent * 100;
  const sign = pts >= 0 ? '+' : '−';
  deltaEl.textContent = `${sign}${Math.abs(pts).toFixed(2)} pts`;
  deltaEl.classList.toggle('is-up', pts >= 0);
  $(`[data-testid="${prefix}-copy"]`).textContent =
    `${variant.hint} The tracked slice would be ${formatPercent(cmp.b.effectivePercent, 2)} instead of ${formatPercent(cmp.a.effectivePercent, 2)}.`;
}

function refresh({ sound = false, custom = false } = {}) {
  if (custom) setPresetActive('custom');
  const projection = project(state);
  render(projection, { sound });
  return projection;
}

function loadPreset(id) {
  const preset = getPreset(id);
  state = structuredClone(preset.model);
  setPresetActive(id);
  hydrateFromState();
  // Employee preset should keep grant as focus; also add a visible grant focus radio when enabled.
  refresh({ sound: true });
  whoosh();
}

function addFounder() {
  const n = state.founders.length + 1;
  state.founders.push({ id: `f-${Date.now()}`, name: `Founder ${n}`, weight: 10 });
  renderPeople();
  refresh({ sound: true, custom: true });
  blip();
}

function addSafe() {
  state.safes.push({
    id: `safe-${Date.now()}`,
    name: `SAFE ${state.safes.length + 1}`,
    amount: 250_000,
    type: 'post',
    cap: 8_000_000,
    discount: 0,
  });
  renderSafes();
  refresh({ sound: true, custom: true });
  blip();
}

function onFounderEvent(event) {
  const row = event.target.closest('.founder-row');
  if (!row) return;
  const founder = state.founders.find((f) => f.id === row.dataset.id);
  if (!founder) return;
  if (event.target.dataset.role === 'remove') {
    if (state.founders.length < 2) return;
    state.founders = state.founders.filter((f) => f.id !== row.dataset.id);
    if (state.focusId === row.dataset.id) state.focusId = state.founders[0].id;
    renderPeople();
    refresh({ sound: true, custom: true });
    blip();
    return;
  }
  readFormIntoState();
  if (event.type === 'input') maybeTick();
  refresh({ custom: true, sound: event.type === 'change' });
}

function onSafeEvent(event) {
  const card = event.target.closest('.safe-card');
  if (!card) return;
  if (event.target.dataset.role === 'remove') {
    state.safes = state.safes.filter((s) => s.id !== card.dataset.id);
    renderSafes();
    refresh({ sound: true, custom: true });
    blip();
    return;
  }
  readFormIntoState();
  if (event.type === 'input') maybeTick();
  refresh({ custom: true, sound: event.type === 'change' });
}

function maybeTick() {
  const now = Date.now();
  if (now - lastTick > 90) {
    tick();
    lastTick = now;
  }
}

function onFieldChange(sound) {
  readFormIntoState();
  toggleSections();
  if (state.grant.enabled && state.focusId === 'grant') {
    const grantRadio = $('#focus-grant');
    if (grantRadio) grantRadio.checked = true;
  }
  refresh({ sound, custom: true });
}

function applyLab(kind) {
  const variants = labVariants(state);
  const next = variants[kind].model;
  state = structuredClone(next);
  setPresetActive('custom');
  hydrateFromState();
  refresh({ sound: true });
  whoosh();
}

async function copyShare() {
  const url = shareUrl(state, `${location.origin}${location.pathname}`);
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const tmp = document.createElement('textarea');
    tmp.value = url;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    tmp.remove();
  }
  const toast = $('#toast');
  toast.hidden = false;
  toast.textContent = 'Link copied';
  chime();
  setTimeout(() => { toast.hidden = true; }, 1800);
}

function exportJson() {
  const projection = project(state);
  const payload = {
    app: 'Slicebench',
    savedAt: new Date().toISOString(),
    model: toState(state),
    focus: projection.focus,
    stages: projection.stages,
    warnings: projection.warnings,
    insights: projection.insights,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'slicebench.json';
  a.click();
  URL.revokeObjectURL(a.href);
  blip();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

function bind() {
  loadMutePreference();
  syncMuteButton();
  $('#mute-toggle').addEventListener('click', () => {
    setMuted(!isMuted());
    syncMuteButton();
    if (!isMuted()) blip();
  });

  $$('.preset-chip').forEach((btn) => {
    btn.addEventListener('click', () => loadPreset(btn.dataset.preset));
  });

  $('#add-founder').addEventListener('click', addFounder);
  $('#add-safe').addEventListener('click', addSafe);
  $('#founder-list').addEventListener('input', onFounderEvent);
  $('#founder-list').addEventListener('change', onFounderEvent);
  $('#founder-list').addEventListener('click', onFounderEvent);
  $('#safe-list').addEventListener('input', onSafeEvent);
  $('#safe-list').addEventListener('change', onSafeEvent);
  $('#safe-list').addEventListener('click', onSafeEvent);

  const fields = [
    '#field-pool', '#round-enabled', '#field-round-name', '#field-round-amount',
    '#field-round-pre', '#field-pool-target', '#grant-enabled', '#field-grant-name',
    '#field-grant-pct', '#field-vest', '#field-cliff', '#field-leave',
    '#field-exit-conservative', '#field-exit-base', '#field-exit-breakout', '#field-salary',
  ];
  for (const sel of fields) {
    const el = $(sel);
    el.addEventListener('input', () => { maybeTick(); onFieldChange(false); });
    el.addEventListener('change', () => onFieldChange(true));
  }

  const grantRadio = $('#focus-grant');
  grantRadio.addEventListener('change', () => {
    if (grantRadio.checked) {
      state.focusId = 'grant';
      refresh({ sound: true, custom: true });
      blip();
    }
  });

  $('#lab-apply-pool').addEventListener('click', () => applyLab('pool'));
  $('#lab-apply-raise').addEventListener('click', () => applyLab('raise'));
  $('#share-copy').addEventListener('click', () => { copyShare(); });
  $('#export-json').addEventListener('click', exportJson);
  $('#print-one').addEventListener('click', () => window.print());

  const drawer = $('#sources-drawer');
  $('#sources-open').addEventListener('click', () => drawer.showModal());
  $('#sources-close').addEventListener('click', () => drawer.close());
  drawer.addEventListener('click', (event) => {
    if (event.target === drawer) drawer.close();
  });

  window.addEventListener('hashchange', () => {
    const incoming = applyHash(location.hash, null);
    if (!incoming) return;
    state = { ...defaultModel(), ...incoming };
    setPresetActive('custom');
    hydrateFromState();
    refresh();
  });
}

function boot() {
  bind();
  const incoming = applyHash(location.hash, null);
  if (incoming) {
    state = { ...defaultModel(), ...incoming };
    setPresetActive('custom');
  } else {
    state = defaultModel();
    setPresetActive(DEFAULT_PRESET_ID);
  }
  hydrateFromState();
  refresh();
}

boot();
