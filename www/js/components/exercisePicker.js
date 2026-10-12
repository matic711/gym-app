import { searchExercises } from '../exercises.js';
import { escapeHtml } from '../util.js';

function customEntryHtml(query) {
  const trimmed = query.trim();
  if (!trimmed) return '';
  const exists = searchExercises(trimmed).some(g => g.exercises.some(e => e.toLowerCase() === trimmed.toLowerCase()));
  if (exists) return '';
  return `
<button type="button" data-pick="${escapeHtml(trimmed)}" data-group="" style="width: 100%; text-align: left; min-height: 52px; border: 0; border-radius: 12px; background: var(--accentSoft); color: var(--accentText); padding: 0 14px; margin: 6px 0; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">+ Dodaj vajo po meri: "${escapeHtml(trimmed)}"</button>`;
}

function listHtml(query) {
  const groups = searchExercises(query);
  const custom = customEntryHtml(query);
  if (!groups.length) {
    return custom || `<div style="padding: 24px 4px; text-align: center; color: var(--text2); font-size: 14px">Ni zadetkov.</div>`;
  }
  return custom + groups.map(g => `
<div style="padding: 14px 4px 6px; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text2)">${escapeHtml(g.group)}</div>
${g.exercises.map(name => `
<button type="button" data-pick="${escapeHtml(name)}" data-group="${escapeHtml(g.group)}" style="width: 100%; text-align: left; min-height: 52px; border: 0; border-top: 1px solid var(--line); background: transparent; padding: 0 4px; font: inherit; font-size: 16px; color: var(--text); cursor: pointer">${escapeHtml(name)}</button>`).join('')}
`).join('');
}

// A self-contained overlay appended directly to <body> — independent of
// whichever screen is mounted, so it doesn't need to hook into that
// screen's own render cycle.
export function openExercisePicker({ onPick }) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; display: flex; align-items: flex-end;';
  overlay.innerHTML = `
<div style="background: var(--bg); width: 100%; max-width: 560px; margin: 0 auto; max-height: 82vh; border-radius: 20px 20px 0 0; box-shadow: 0 -4px 24px rgba(0,0,0,0.2); display: flex; flex-direction: column; overflow: hidden">
<div style="padding: 16px 20px 8px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0">
<h2 style="margin: 0; font-size: 19px; font-weight: 700">Dodaj vajo</h2>
<button type="button" data-action="close" aria-label="Zapri" style="width: 40px; height: 40px; border: 0; border-radius: 20px; background: var(--fill); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
</button>
</div>
<div style="padding: 4px 20px 12px; flex-shrink: 0">
<label style="height: 44px; border-radius: 12px; background: var(--card); display: flex; align-items: center; gap: 8px; padding: 0 14px; color: var(--text2); box-shadow: var(--shadow)">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4 4"></path></svg>
<input id="exercise-picker-search" type="search" placeholder="Išči vaje ali mišično skupino" style="flex-grow: 1; border: 0; outline: none; background: transparent; font: inherit; font-size: 15px; color: var(--text)">
</label>
</div>
<div id="exercise-picker-list" style="overflow-y: auto; padding: 0 20px 20px; flex-grow: 1"></div>
</div>`;

  document.body.appendChild(overlay);

  const listEl = overlay.querySelector('#exercise-picker-list');
  const searchEl = overlay.querySelector('#exercise-picker-search');

  function renderList() {
    listEl.innerHTML = listHtml(searchEl.value);
    listEl.querySelectorAll('[data-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        onPick({ name: btn.getAttribute('data-pick'), muscle: btn.getAttribute('data-group') });
        close();
      });
    });
  }

  function close() {
    overlay.remove();
  }

  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  searchEl.addEventListener('input', renderList);

  renderList();
  searchEl.focus();
}
