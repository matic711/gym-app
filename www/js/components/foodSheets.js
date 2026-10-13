// Bottom sheets for food logging: add (search / scan / new), amount, product form.
// Appended to <body> like the exercise picker, independent of the screen.
import { store } from '../state.js';
import { escapeHtml, fmtNum } from '../util.js';
import {
  MEALS, macrosFor, recentProducts, searchLocal, searchOff, lookupBarcode,
  addEntry, updateEntry, removeEntry, saveProduct, deleteProduct, ownProducts
} from '../nutrition.js';
import { scanBarcode } from '../scanner.js';

function num(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function f1(n) { return n == null ? '' : String(Math.round(n * 10) / 10).replace('.', ','); }

const INPUT = 'height: 44px; box-sizing: border-box; border: 0; border-radius: 12px; background: var(--card); padding: 0 12px; font: inherit; font-size: 16px; color: var(--text); outline: none; box-shadow: var(--shadow); width: 100%';
const LABEL = 'font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text2)';
const BTN = 'height: 44px; border: 0; border-radius: 12px; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; padding: 0 14px';

function sheet(title, bodyHtml) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; display: flex; align-items: flex-end;';
  overlay.innerHTML = `
<div style="background: var(--bg); width: 100%; max-width: 560px; margin: 0 auto; max-height: 88vh; border-radius: 20px 20px 0 0; box-shadow: 0 -4px 24px rgba(0,0,0,0.25); display: flex; flex-direction: column; overflow: hidden">
<div style="padding: 16px 20px 8px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0">
<h2 style="margin: 0; font-size: 19px; font-weight: 700; min-width: 0">${title}</h2>
<button type="button" data-sheet-close aria-label="Zapri" style="width: 40px; height: 40px; border: 0; border-radius: 20px; background: var(--fill); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
</button>
</div>
<div data-sheet-body style="overflow-y: auto; padding: 4px 20px calc(env(safe-area-inset-bottom, 0px) + 20px); display: flex; flex-direction: column; gap: 12px">${bodyHtml}</div>
</div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('[data-sheet-close]').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  return { el: overlay, body: overlay.querySelector('[data-sheet-body]'), close };
}

function productRow(p, i) {
  const kcal = p.per100 && p.per100.kcal != null ? `${fmtNum(p.per100.kcal)} kcal / 100 g` : 'brez hranilnih vrednosti';
  return `<button type="button" data-pick="${i}" style="width: 100%; text-align: left; border: 0; border-top: ${i ? '1px solid var(--line)' : '0'}; background: transparent; padding: 10px 2px; font: inherit; color: var(--text); cursor: pointer; display: flex; justify-content: space-between; gap: 10px; align-items: center">
<span style="display: flex; flex-direction: column; gap: 2px; min-width: 0">
<span style="font-size: 15px; font-weight: 600">${escapeHtml(p.name)}${p.source === 'own' ? ' <span style="font-size: 11px; font-weight: 700; color: var(--accentText)">MOJ</span>' : ''}</span>
<span style="font-size: 12px; color: var(--text2)">${escapeHtml([p.brand, kcal].filter(Boolean).join(' · '))}</span>
</span>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" style="color: var(--accentText); flex-shrink: 0"><path d="M12 5v14M5 12h14"></path></svg>
</button>`;
}

// ---- add: search, scan, recent, new
export function openAddFood({ iso, meal }) {
  const mealLabel = (MEALS.find(m => m.key === meal) || MEALS[0]).label;
  const s = sheet(`Dodaj · ${mealLabel}`, `
<label style="height: 44px; border-radius: 12px; background: var(--card); display: flex; align-items: center; gap: 8px; padding: 0 14px; color: var(--text2); box-shadow: var(--shadow)">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4 4"></path></svg>
<input id="food-search" type="search" placeholder="Išči živilo ali izdelek" enterkeyhint="search" style="flex-grow: 1; border: 0; outline: none; background: transparent; font: inherit; font-size: 16px; color: var(--text)">
</label>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
<button type="button" data-action="scan" style="${BTN}; background: var(--accent); color: var(--onAccent); display: flex; align-items: center; justify-content: center; gap: 8px">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8"></path></svg>
Skeniraj
</button>
<button type="button" data-action="new" style="${BTN}; background: var(--fill); color: var(--text)">Nov izdelek</button>
</div>
<div data-status style="font-size: 13px; color: var(--text2); min-height: 18px"></div>
<div data-list></div>`);

  const input = s.el.querySelector('#food-search');
  const listEl = s.el.querySelector('[data-list]');
  const statusEl = s.el.querySelector('[data-status]');
  let items = [];

  function renderList(title, list, extra = '') {
    items = list;
    listEl.innerHTML = (title ? `<div style="${LABEL}; padding: 4px 0 2px">${title}</div>` : '') +
      (list.length ? list.map(productRow).join('') : '') + extra;
    listEl.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
      const p = items[Number(b.dataset.pick)];
      s.close();
      if (p.per100 && p.per100.kcal != null) openAmount({ iso, meal, product: p });
      else openProductForm({ prefill: p, onSaved: saved => openAmount({ iso, meal, product: saved }) });
    }));
    listEl.querySelector('[data-action="online"]')?.addEventListener('click', online);
  }

  function refresh() {
    const q = input.value.trim();
    statusEl.textContent = '';
    if (!q) {
      const recent = recentProducts(store.data);
      renderList(recent.length ? 'Nedavno' : '', recent, recent.length ? '' : '<div style="font-size: 14px; color: var(--text2); padding: 8px 0">Poišči izdelek, skeniraj črtno kodo ali dodaj svojega.</div>');
      return;
    }
    const local = searchLocal(store.data, q);
    renderList(local.length ? 'Moji in shranjeni' : '', local, q.length >= 2
      ? `<button type="button" data-action="online" style="${BTN}; width: 100%; margin-top: 8px; background: var(--accentSoft); color: var(--accentText)">Išči »${escapeHtml(q)}« v bazi Open Food Facts</button>` : '');
  }

  async function online() {
    const q = input.value.trim();
    if (q.length < 2) return;
    statusEl.textContent = 'Iščem v bazi …';
    try {
      const res = await searchOff(q);
      const local = searchLocal(store.data, q);
      const seen = new Set(local.map(p => p.code).filter(Boolean));
      const merged = [...local, ...res.filter(p => !seen.has(p.code))];
      statusEl.textContent = res.length ? '' : 'V bazi ni zadetkov. Dodaj izdelek sam.';
      renderList(merged.length ? 'Rezultati' : '', merged);
    } catch (e) {
      statusEl.textContent = 'Baza ni dosegljiva (ni povezave?). Izdelek lahko dodaš ročno.';
    }
  }

  async function scan() {
    statusEl.textContent = '';
    let code;
    try { code = await scanBarcode(); } catch (e) { statusEl.textContent = e.message || 'Skeniranje ni uspelo.'; return; }
    if (!code) return;
    statusEl.textContent = `Iščem izdelek ${code} …`;
    let res;
    try { res = await lookupBarcode(store.data, code); } catch (e) {
      statusEl.textContent = 'Baza ni dosegljiva. Izdelek lahko dodaš ročno.';
      res = { product: null };
    }
    s.close();
    if (res.product) { openAmount({ iso, meal, product: res.product }); return; }
    openProductForm({
      prefill: { ...(res.partial || {}), code },
      note: res.partial ? 'Izdelek je v bazi, a brez hranilnih vrednosti. Dopolni jih z embalaže.' : `Izdelka s kodo ${code} ni v bazi. Dodaj ga — naslednjič ga bo skener našel.`,
      onSaved: saved => openAmount({ iso, meal, product: saved })
    });
  }

  input.addEventListener('input', refresh);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); online(); } });
  s.el.querySelector('[data-action="scan"]').addEventListener('click', scan);
  s.el.querySelector('[data-action="new"]').addEventListener('click', () => {
    s.close();
    openProductForm({ prefill: { name: input.value.trim() }, onSaved: saved => openAmount({ iso, meal, product: saved }) });
  });
  refresh();
}

// ---- amount: grams + meal, add or edit an entry
export function openAmount({ iso, meal, product, entry }) {
  const per = product.per100 || entry.per100;
  const serving = product.servingG || (entry && entry.servingG) || null;
  let grams = entry ? entry.grams : serving || 100;
  let curMeal = entry ? entry.meal : meal;
  const chips = [...new Set([serving, 50, 100, 150, 200].filter(Boolean))];

  const s = sheet(escapeHtml(product.name || entry.name), `
<div style="font-size: 13px; color: var(--text2)">${escapeHtml([product.brand || (entry && entry.brand), product.code || (entry && entry.code)].filter(Boolean).join(' · '))}</div>
<div style="font-size: 13px; color: var(--text2)">Na 100 g: ${fmtNum(per.kcal || 0)} kcal · B ${f1(per.protein || 0)} g · OH ${f1(per.carbs || 0)} g · M ${f1(per.fat || 0)} g</div>
<div style="display: flex; flex-direction: column; gap: 6px">
<label for="food-grams" style="${LABEL}">Količina (g)</label>
<input id="food-grams" type="text" inputmode="decimal" value="${f1(grams)}" style="${INPUT}; font-size: 22px; font-weight: 700">
<div style="display: flex; gap: 6px; flex-wrap: wrap">${chips.map(g => `<button type="button" data-g="${g}" style="height: 34px; padding: 0 12px; border: 0; border-radius: 17px; background: var(--fill); color: var(--text); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer">${g === serving ? `1 porcija (${g} g)` : `${g} g`}</button>`).join('')}</div>
</div>
<div style="display: flex; flex-direction: column; gap: 6px">
<span style="${LABEL}">Obrok</span>
<div role="radiogroup" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 4px; background: var(--fill); border-radius: 12px">
${MEALS.map(m => `<button type="button" data-meal="${m.key}" style="height: 34px; border: 0; border-radius: 9px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer">${m.label}</button>`).join('')}
</div>
</div>
<div data-preview style="background: var(--card); border-radius: 14px; padding: 12px 14px; box-shadow: var(--shadow)"></div>
<div style="display: grid; grid-template-columns: ${entry ? '1fr 2fr' : '1fr'}; gap: 10px">
${entry ? `<button type="button" data-action="delete" style="${BTN}; background: var(--fill); color: var(--danger)">Izbriši</button>` : ''}
<button type="button" data-action="save" style="${BTN}; background: var(--accent); color: var(--onAccent)">${entry ? 'Shrani' : 'Dodaj'}</button>
</div>
${product.source === 'own' ? `<button type="button" data-action="editProduct" style="${BTN}; background: transparent; color: var(--accentText)">Uredi izdelek</button>` : ''}`);

  const gIn = s.el.querySelector('#food-grams');
  const preview = s.el.querySelector('[data-preview]');
  function update() {
    s.el.querySelectorAll('[data-meal]').forEach(b => {
      const on = b.dataset.meal === curMeal;
      b.style.background = on ? 'var(--card)' : 'transparent';
      b.style.color = on ? 'var(--text)' : 'var(--text2)';
      b.style.boxShadow = on ? '0 1px 3px rgba(0,0,0,0.08)' : 'none';
    });
    const m = macrosFor({ grams: num(gIn.value) || 0, per100: per });
    preview.innerHTML = `<div style="font-size: 24px; font-weight: 700">${fmtNum(m.kcal)} <span style="font-size: 14px; font-weight: 500; color: var(--text2)">kcal</span></div>
<div style="font-size: 13px; color: var(--text2)">Beljakovine ${f1(m.protein)} g · Ogljikovi hidrati ${f1(m.carbs)} g · Maščobe ${f1(m.fat)} g</div>`;
  }
  gIn.addEventListener('input', update);
  s.el.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => { gIn.value = f1(Number(b.dataset.g)); update(); }));
  s.el.querySelectorAll('[data-meal]').forEach(b => b.addEventListener('click', () => { curMeal = b.dataset.meal; update(); }));
  s.el.querySelector('[data-action="save"]').addEventListener('click', () => {
    const g = num(gIn.value);
    if (!g || g <= 0) { gIn.focus(); return; }
    if (entry) updateEntry(store.data, iso, entry.id, { grams: g, meal: curMeal });
    else addEntry(store.data, iso, product, g, curMeal);
    store.save();
    s.close();
  });
  s.el.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    removeEntry(store.data, iso, entry.id);
    store.save();
    s.close();
  });
  s.el.querySelector('[data-action="editProduct"]')?.addEventListener('click', () => {
    s.close();
    openProductForm({ prefill: product, onSaved: saved => openAmount({ iso, meal: curMeal, product: saved, entry }) });
  });
  update();
}

// ---- product form: create or edit an own product (optionally with a barcode)
export function openProductForm({ prefill = {}, note = '', onSaved }) {
  const p = prefill.per100 || {};
  const editing = prefill.source === 'own' && prefill.key;
  const field = (id, label, value, mode = 'text', required = false) => `<div style="display: flex; flex-direction: column; gap: 6px; min-width: 0">
<label for="${id}" style="${LABEL}">${label}${required ? ' *' : ''}</label>
<input id="${id}" type="text" inputmode="${mode}" value="${escapeHtml(value ?? '')}" style="${INPUT}">
</div>`;
  const s = sheet(editing ? 'Uredi izdelek' : 'Nov izdelek', `
${note ? `<div style="font-size: 14px; background: var(--accentSoft); color: var(--text); border-radius: 12px; padding: 10px 12px">${escapeHtml(note)}</div>` : ''}
${field('pf-name', 'Ime', prefill.name || '', 'text', true)}
${field('pf-brand', 'Znamka', prefill.brand || '')}
${field('pf-code', 'Črtna koda', prefill.code || '', 'numeric')}
<div style="${LABEL}; padding-top: 4px">Hranilne vrednosti na 100 g</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
${field('pf-kcal', 'Kalorije (kcal)', f1(p.kcal), 'decimal', true)}
${field('pf-protein', 'Beljakovine (g)', f1(p.protein), 'decimal')}
${field('pf-carbs', 'Ogljikovi hidrati (g)', f1(p.carbs), 'decimal')}
${field('pf-fat', 'Maščobe (g)', f1(p.fat), 'decimal')}
</div>
${field('pf-serving', 'Porcija (g, neobvezno)', prefill.servingG ? f1(prefill.servingG) : '', 'decimal')}
<div data-error style="font-size: 13px; color: var(--danger); min-height: 18px"></div>
<button type="button" data-action="save" style="${BTN}; background: var(--accent); color: var(--onAccent)">Shrani izdelek</button>
${editing ? `<button type="button" data-action="delete" style="${BTN}; background: transparent; color: var(--danger)">Izbriši izdelek</button>` : ''}`);

  const val = id => s.el.querySelector('#' + id).value.trim();
  s.el.querySelector('[data-action="save"]').addEventListener('click', () => {
    const name = val('pf-name'), kcal = num(val('pf-kcal'));
    const err = s.el.querySelector('[data-error]');
    if (!name) { err.textContent = 'Vpiši ime izdelka.'; return; }
    if (kcal == null || kcal < 0) { err.textContent = 'Vpiši kalorije na 100 g.'; return; }
    const code = val('pf-code').replace(/\s+/g, '');
    const product = {
      key: editing ? (code && `code:${code}` !== prefill.key ? undefined : prefill.key) : undefined,
      code, name, brand: val('pf-brand'), source: 'own',
      per100: { kcal: Math.round(kcal), protein: num(val('pf-protein')) || 0, carbs: num(val('pf-carbs')) || 0, fat: num(val('pf-fat')) || 0 },
      servingG: num(val('pf-serving')) || null
    };
    if (editing && product.key === undefined) deleteProduct(store.data, prefill.key); // barcode changed
    const saved = saveProduct(store.data, product);
    store.save();
    s.close();
    if (onSaved) onSaved(saved);
  });
  s.el.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    if (!confirm(`Izbrišem izdelek "${prefill.name}"? Že vpisani obroki ostanejo.`)) return;
    deleteProduct(store.data, prefill.key);
    store.save();
    s.close();
  });
}

// ---- own products list
export function openOwnProducts() {
  const list = ownProducts(store.data);
  const s = sheet('Moji izdelki', list.length
    ? `<div>${list.map(productRow).join('')}</div>`
    : '<div style="font-size: 14px; color: var(--text2); padding: 8px 0">Še nimaš svojih izdelkov. Dodaš jih pri dodajanju hrane (Nov izdelek ali skeniranje neznane kode).</div>');
  s.el.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    const p = list[Number(b.dataset.pick)];
    s.close();
    openProductForm({ prefill: p, onSaved: () => openOwnProducts() });
  }));
}
