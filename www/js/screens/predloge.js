import { store } from '../state.js';
import { rerenderPreservingFocus, escapeHtml } from '../util.js';

let query = '';

function cardsHtml(templates) {
  const q = query.trim().toLowerCase();
  const filtered = q ? templates.filter(t =>
    t.name.toLowerCase().includes(q) || t.exercises.some(e => e.name.toLowerCase().includes(q))
  ) : templates;

  if (!filtered.length) {
    return `<div style="padding: 24px 4px; text-align: center; color: var(--text2); font-size: 14px">Ni predlog, ki bi ustrezale iskanju.</div>`;
  }

  return filtered.map(t => {
    const chips = t.exercises.slice(0, 5).map(e => `<span style="font-size: 12px; font-weight: 500; padding: 5px 10px; border-radius: 999px; background: var(--fill); color: var(--text2)">${escapeHtml(e.name)}</span>`).join('');
    const extra = t.exercises.length > 5 ? `<span style="font-size: 12px; font-weight: 500; padding: 5px 10px; border-radius: 999px; background: var(--fill); color: var(--text2)">+${t.exercises.length - 5}</span>` : '';
    return `
<article style="background: var(--card); border-radius: 22px; padding: 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px">
<div style="display: flex; flex-direction: column; gap: 3px">
<h3 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.01em">${escapeHtml(t.name)}</h3>
<div style="font-size: 13px; color: var(--text2)">${t.exercises.length} vaj · ~${Math.round(t.exercises.length * 9.2)} min</div>
</div>
<a href="#" data-action="start" data-id="${t.id}" style="height: 36px; padding: 0 14px; border-radius: 18px; background: var(--accentSoft); color: var(--accentText); display: flex; align-items: center; gap: 6px; text-decoration: none; font-size: 14px; font-weight: 600; flex-shrink: 0">
<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"></path></svg>
Začni
</a>
</div>
<div style="display: flex; flex-wrap: wrap; gap: 6px">${chips}${extra}</div>
</article>`;
  }).join('');
}

function shell(templates) {
  return `
<main style="padding: 28px 20px 0; display: flex; flex-direction: column; gap: 16px">
<header style="display: flex; align-items: flex-end; justify-content: space-between">
<h1 style="margin: 0; font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">Trening</h1>
<a href="#" data-action="create" aria-label="Nova predloga" style="width: 44px; height: 44px; border-radius: 22px; background: var(--accent); color: var(--onAccent); display: flex; align-items: center; justify-content: center; text-decoration: none">
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
</a>
</header>

<div role="tablist" aria-label="Pogled" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 4px; background: var(--fill); border-radius: 12px">
<a href="#/trening" role="tab" aria-selected="false" style="height: 36px; border-radius: 9px; color: var(--text2); display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 14px; font-weight: 600">Treningi</a>
<a href="#/predloge" role="tab" aria-selected="true" style="height: 36px; border-radius: 9px; background: var(--card); color: var(--text); display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 14px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.08)">Predloge</a>
</div>

<label style="height: 44px; border-radius: 12px; background: var(--card); display: flex; align-items: center; gap: 8px; padding: 0 14px; color: var(--text2); box-shadow: var(--shadow)">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4 4"></path></svg>
<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Išči predloge</span>
<input id="predloge-search" type="search" placeholder="Išči predloge" value="${escapeHtml(query)}" style="flex-grow: 1; border: 0; outline: none; background: transparent; font: inherit; font-size: 15px; color: var(--text)">
</label>

<div id="predloge-cards" style="display: flex; flex-direction: column; gap: 16px">
${cardsHtml(templates)}
</div>

<a href="#" data-action="create" style="height: 56px; border-radius: 18px; border: 1.5px dashed var(--line); color: var(--accentText); display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; font-size: 15px; font-weight: 600">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
Ustvari predlogo
</a>
</main>`;
}

export function mount(root, ctx) {
  function wireCards() {
    root.querySelectorAll('[data-action="start"]').forEach(el => el.addEventListener('click', (e) => {
      e.preventDefault();
      if (store.data.activeWorkout) { ctx.navigate('nov'); return; }
      ctx.navigate('nov', { template: el.getAttribute('data-id') });
    }));
  }

  function render() {
    root.innerHTML = shell(store.data.templates);
    root.querySelectorAll('[data-action="create"]').forEach(el => el.addEventListener('click', (e) => {
      e.preventDefault();
      if (store.data.activeWorkout) { ctx.navigate('nov'); return; }
      ctx.navigate('nov', { blank: '1' });
    }));
    root.querySelector('#predloge-search').addEventListener('input', (e) => {
      query = e.target.value;
      rerenderPreservingFocus(root, () => {
        root.querySelector('#predloge-cards').innerHTML = cardsHtml(store.data.templates);
        wireCards();
      });
    });
    wireCards();
  }
  render();
  return store.subscribe(render);
}
