import { store } from '../state.js';
import { isoDate, addDays, fromIso, fmtDate, fmtNum, escapeHtml } from '../util.js';
import { MEALS, dayTotals, goalsOf, macrosFor, nutritionEnabled, ensureNutrition } from '../nutrition.js';
import { openAddFood, openAmount, openOwnProducts } from '../components/foodSheets.js';

function f0(n) { return fmtNum(Math.round(n || 0)); }

function relLabel(d, today) {
  const diff = Math.round((fromIso(isoDate(d)) - fromIso(isoDate(today))) / 86400000);
  if (diff === 0) return `Danes, ${fmtDate(d)}`;
  if (diff === -1) return `Včeraj, ${fmtDate(d)}`;
  return fmtDate(d);
}

function macroBar(label, value, goal, color) {
  const pct = goal ? Math.min(100, Math.round(value / goal * 100)) : 0;
  const over = goal && value > goal * 1.1;
  return `<div style="display: flex; flex-direction: column; gap: 4px; min-width: 0">
<span style="font-size: 12px; color: var(--text2)">${label}</span>
<span style="font-size: 15px; font-weight: 700; color: ${over ? 'var(--danger)' : 'var(--text)'}">${f0(value)}<span style="font-size: 12px; color: var(--text2); font-weight: 500"> / ${f0(goal)} g</span></span>
<div style="height: 6px; border-radius: 3px; background: var(--fill); overflow: hidden"><div style="width: ${pct}%; height: 6px; border-radius: 3px; background: ${color}"></div></div>
</div>`;
}

function template(selected) {
  const data = store.data;
  const today = new Date();
  const iso = isoDate(selected);
  const isToday = iso === isoDate(today);
  const t = dayTotals(data, iso);
  const g = goalsOf(data);
  const left = g.kcal - t.kcal;
  const pct = g.kcal ? Math.min(100, Math.round(t.kcal / g.kcal * 100)) : 0;
  const C = 2 * Math.PI * 34;

  const mealsHtml = MEALS.map(m => {
    const meal = t.byMeal[m.key];
    return `<section style="background: var(--card); border-radius: 22px; padding: 14px 16px 8px; display: flex; flex-direction: column; box-shadow: var(--shadow)">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 4px">
<h2 style="margin: 0; font-size: 16px; font-weight: 600">${m.label}${meal.kcal ? ` <span style="font-size: 13px; font-weight: 500; color: var(--text2)">· ${f0(meal.kcal)} kcal</span>` : ''}</h2>
<button type="button" data-add="${m.key}" aria-label="Dodaj v ${m.label}" style="height: 34px; padding: 0 12px; border: 0; border-radius: 17px; background: var(--accentSoft); color: var(--accentText); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer">+ Dodaj</button>
</div>
${meal.entries.map((e, i) => {
      const mm = macrosFor(e);
      return `<button type="button" data-entry="${e.id}" style="width: 100%; text-align: left; border: 0; border-top: 1px solid var(--line); background: transparent; padding: 10px 0; font: inherit; color: var(--text); cursor: pointer; display: flex; justify-content: space-between; gap: 10px; align-items: center">
<span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${escapeHtml(e.name)}</span><span style="font-size: 12px; color: var(--text2)">${escapeHtml([e.brand, `${f0(e.grams)} g`].filter(Boolean).join(' · '))} · B ${f0(mm.protein)} · OH ${f0(mm.carbs)} · M ${f0(mm.fat)}</span></span>
<span style="font-size: 15px; font-weight: 700; flex-shrink: 0">${f0(mm.kcal)} <span style="font-size: 12px; font-weight: 500; color: var(--text2)">kcal</span></span>
</button>`;
    }).join('')}
</section>`;
  }).join('');

  return `
<main style="padding: 28px 20px 0; display: flex; flex-direction: column; gap: 14px">
<header style="display: flex; flex-direction: column; gap: 12px">
<h1 style="margin: 0; font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">Prehrana</h1>
<div style="display: flex; align-items: center; justify-content: space-between; background: var(--card); border-radius: 14px; padding: 0 4px; box-shadow: var(--shadow)">
<button type="button" aria-label="Prejšnji dan" data-action="prevDay" style="width: 44px; height: 44px; border: 0; background: transparent; color: var(--accentText); display: flex; align-items: center; justify-content: center; cursor: pointer"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg></button>
<div style="font-size: 15px; font-weight: 600">${relLabel(selected, today)}</div>
<button type="button" aria-label="Naslednji dan" data-action="nextDay" ${isToday ? 'disabled' : ''} style="width: 44px; height: 44px; border: 0; background: transparent; color: ${isToday ? 'var(--text2)' : 'var(--accentText)'}; display: flex; align-items: center; justify-content: center; cursor: ${isToday ? 'default' : 'pointer'}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"></path></svg></button>
</div>
</header>

<section style="background: var(--card); border-radius: 22px; padding: 18px; display: flex; flex-direction: column; gap: 16px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: center; gap: 18px">
<svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true" style="flex-shrink: 0">
<circle cx="42" cy="42" r="34" fill="none" style="stroke: var(--fill)" stroke-width="10"></circle>
<circle cx="42" cy="42" r="34" fill="none" style="stroke: ${left < -g.kcal * 0.05 ? 'var(--danger)' : 'var(--accent)'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(pct / 100 * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 42 42)"></circle>
</svg>
<div style="display: flex; flex-direction: column; gap: 4px; min-width: 0">
<div style="font-size: 13px; font-weight: 600; color: var(--text2)">Kalorije</div>
<div style="font-size: 26px; font-weight: 700; letter-spacing: -0.02em">${f0(t.kcal)} <span style="font-size: 16px; font-weight: 500; color: var(--text2)">/ ${f0(g.kcal)} kcal</span></div>
<div style="font-size: 13px; color: ${left < 0 ? 'var(--danger)' : 'var(--text2)'}">${left >= 0 ? `Še ${f0(left)} kcal` : `${f0(-left)} kcal nad ciljem`}</div>
</div>
</div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px">
${macroBar('Beljakovine', t.protein, g.protein, 'var(--good)')}
${macroBar('Ogljikovi h.', t.carbs, g.carbs, 'var(--accent)')}
${macroBar('Maščobe', t.fat, g.fat, 'var(--mood)')}
</div>
</section>

${mealsHtml}

<div style="display: flex; justify-content: space-between; gap: 10px; padding: 0 2px 8px">
<button type="button" data-action="ownProducts" style="border: 0; background: transparent; color: var(--accentText); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; padding: 8px 0">Moji izdelki</button>
<a href="#/nastavitve" style="color: var(--accentText); font-size: 15px; font-weight: 600; text-decoration: none; padding: 8px 0">Cilji ›</a>
</div>
<div style="font-size: 11px; color: var(--text2); text-align: center; padding-bottom: 8px">Podatki o izdelkih: Open Food Facts (odprta baza)</div>
</main>`;
}

export function mount(root, ctx) {
  if (!nutritionEnabled(store.data)) { ctx.navigate('home'); return; }
  ensureNutrition(store.data);
  let selected = /^\d{4}-\d{2}-\d{2}$/.test(ctx.params.date || '') ? fromIso(ctx.params.date) : new Date();
  if (selected > new Date()) selected = new Date();

  function render() {
    root.innerHTML = template(selected);
    const iso = isoDate(selected);
    root.querySelector('[data-action="prevDay"]').addEventListener('click', () => { selected = addDays(selected, -1); history.replaceState(null, '', `#/prehrana?date=${isoDate(selected)}`); render(); });
    const next = root.querySelector('[data-action="nextDay"]');
    if (!next.disabled) next.addEventListener('click', () => { selected = addDays(selected, 1); history.replaceState(null, '', `#/prehrana?date=${isoDate(selected)}`); render(); });
    root.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => openAddFood({ iso, meal: b.dataset.add })));
    root.querySelectorAll('[data-entry]').forEach(b => b.addEventListener('click', () => {
      const e = (store.data.nutrition.log[iso] || []).find(x => x.id === b.dataset.entry);
      if (!e) return;
      const product = (e.productKey && store.data.nutrition.products[e.productKey]) || { name: e.name, brand: e.brand, code: e.code, per100: e.per100, servingG: e.servingG };
      openAmount({ iso, meal: e.meal, product: { ...product, per100: e.per100 }, entry: e });
    }));
    root.querySelector('[data-action="ownProducts"]').addEventListener('click', openOwnProducts);
  }
  render();
  return store.subscribe(render);
}
