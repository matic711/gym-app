import { store } from '../state.js';
import { isoDate, addDays, fmtDate } from '../util.js';

const MOOD_MOUTHS = ['M8 17a4.5 4.5 0 0 1 8 0', 'M8.5 16.5c1.2-1.2 5.8-1.2 7 0', 'M8.5 15.5h7', 'M8.5 14.5a4 4 0 0 0 7 0', 'M7.5 13.5a4.5 4.5 0 0 0 9 0z'];
const MOOD_LABELS = ['Slabo', 'Meh', 'V redu', 'Dobro', 'Odlično'];

function findLastWeight(data, beforeIso) {
  let d = beforeIso;
  for (let i = 0; i < 30; i++) {
    d = isoDate(addDays(new Date(d), -1));
    const e = data.wellness[d];
    if (e && e.weight != null) return e.weight;
  }
  return 78.0;
}

function defaultsFor(data, iso) {
  return {
    weight: findLastWeight(data, iso),
    bed: '23:00', wake: '07:00',
    quality: 3, mood: 2, energy: 5, stress: 5, note: ''
  };
}

function relLabel(date, today) {
  const diff = Math.round((date - today) / 86400000);
  if (diff === 0) return `Danes, ${fmtDate(date)}`;
  if (diff === -1) return `Včeraj, ${fmtDate(date)}`;
  if (diff === 1) return `Jutri, ${fmtDate(date)}`;
  return fmtDate(date);
}

function toMin(t) { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; }

export function mount(root, ctx) {
  let selectedDate = new Date();
  let draft = null;

  function loadDraft() {
    const data = store.data;
    const iso = isoDate(selectedDate);
    const saved = data.wellness[iso];
    draft = saved ? { ...saved } : defaultsFor(data, iso);
  }

  function persist() {
    const iso = isoDate(selectedDate);
    store.data.wellness[iso] = { ...draft };
    store.save();
  }

  function render() {
    const today = new Date();
    const iso = isoDate(selectedDate);
    const isToday = iso === isoDate(today);
    const yesterdayIso = isoDate(addDays(selectedDate, -1));
    const yesterdayEntry = store.data.wellness[yesterdayIso];

    let dur = toMin(draft.wake) - toMin(draft.bed);
    if (dur < 0) dur += 1440;

    const wellnessDates = Object.keys(store.data.wellness).sort();
    const startWeight = wellnessDates.length ? store.data.wellness[wellnessDates[0]].weight : draft.weight;
    const goalWeight = store.data.settings.goalWeightKg;
    const span = startWeight - goalWeight;
    const progressPct = span > 0 ? Math.max(0, Math.min(100, Math.round(((startWeight - draft.weight) / span) * 100))) : 0;

    const qualityHtml = [1, 2, 3, 4, 5].map(n => {
      const on = n === draft.quality;
      return `<button type="button" role="radio" aria-checked="${on}" aria-label="Kakovost ${n} od 5" data-action="quality" data-v="${n}" style="width: 36px; height: 36px; border: 0; border-radius: 18px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; ${on ? 'background: var(--sleep); color: var(--onAccent);' : 'background: var(--fill); color: var(--text2);'}">${n}</button>`;
    }).join('');

    const moodHtml = MOOD_LABELS.map((label, i) => {
      const on = i === draft.mood;
      return `<button type="button" role="radio" aria-checked="${on}" data-action="mood" data-v="${i}" style="height: 72px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font: inherit; cursor: pointer; box-sizing: border-box; ${on ? 'border: 2px solid var(--mood); background: var(--fill); color: var(--mood);' : 'border: 2px solid transparent; background: var(--fill); color: var(--text2);'}">
<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M9 9.5h.01M15 9.5h.01"></path><path d="${MOOD_MOUTHS[i]}"></path></svg>
<span style="font-size: 11px; font-weight: 600">${label}</span>
</button>`;
    }).join('');

    root.innerHTML = `
<main style="padding: 28px 20px 0; display: flex; flex-direction: column; gap: 16px">
<header style="display: flex; flex-direction: column; gap: 12px">
<h1 style="margin: 0; font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">Počutje</h1>
<div style="display: flex; align-items: center; justify-content: space-between; background: var(--card); border-radius: 14px; padding: 0 4px; box-shadow: var(--shadow)">
<button type="button" aria-label="Prejšnji dan" data-action="prevDay" style="width: 44px; height: 44px; border: 0; background: transparent; color: var(--accentText); display: flex; align-items: center; justify-content: center; cursor: pointer">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>
</button>
<div style="font-size: 15px; font-weight: 600">${relLabel(selectedDate, today)}</div>
<button type="button" aria-label="Naslednji dan" data-action="nextDay" ${isToday ? 'disabled' : ''} style="width: 44px; height: 44px; border: 0; background: transparent; color: ${isToday ? 'var(--text2)' : 'var(--accentText)'}; display: flex; align-items: center; justify-content: center; cursor: ${isToday ? 'default' : 'pointer'}">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"></path></svg>
</button>
</div>
</header>

<section aria-labelledby="h-teza" style="background: var(--card); border-radius: 22px; padding: 18px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: center; justify-content: space-between">
<h2 id="h-teza" style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--accentText)">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"></rect><path d="M8.5 10.5a3.5 3.5 0 0 1 7 0M12 10.5l1.5-2"></path></svg>
Teža
</h2>
<div style="font-size: 13px; color: var(--text2)">${yesterdayEntry ? `včeraj ${yesterdayEntry.weight.toFixed(1).replace('.', ',')} kg` : 'ni podatka za včeraj'}</div>
</div>
<div style="display: flex; align-items: center; justify-content: space-between">
<button type="button" aria-label="Zmanjšaj težo" data-action="wDown" style="width: 48px; height: 48px; border: 0; border-radius: 24px; background: var(--fill); color: var(--text); font-size: 24px; font-weight: 500; cursor: pointer">−</button>
<div style="display: flex; align-items: baseline; gap: 6px">
<span style="font-size: 44px; font-weight: 700; letter-spacing: -0.03em">${draft.weight.toFixed(1).replace('.', ',')}</span>
<span style="font-size: 18px; font-weight: 500; color: var(--text2)">kg</span>
</div>
<button type="button" aria-label="Povečaj težo" data-action="wUp" style="width: 48px; height: 48px; border: 0; border-radius: 24px; background: var(--fill); color: var(--text); font-size: 24px; font-weight: 500; cursor: pointer">+</button>
</div>
<div style="display: flex; flex-direction: column; gap: 6px">
<div style="height: 6px; border-radius: 3px; background: var(--fill); overflow: hidden">
<div style="width: ${progressPct}%; height: 6px; border-radius: 3px; background: var(--accent)"></div>
</div>
<div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text2)">
<span>Začetek ${startWeight.toFixed(1).replace('.', ',')} kg</span>
<span>Cilj ${goalWeight.toFixed(1).replace('.', ',')} kg</span>
</div>
</div>
</section>

<section aria-labelledby="h-spanec" style="background: var(--card); border-radius: 22px; padding: 18px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: center; justify-content: space-between">
<h2 id="h-spanec" style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--sleep)">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path></svg>
Spanec
</h2>
<div style="font-size: 20px; font-weight: 700">${Math.floor(dur / 60)} <span style="font-size: 13px; font-weight: 500; color: var(--text2)">h</span> ${dur % 60} <span style="font-size: 13px; font-weight: 500; color: var(--text2)">min</span></div>
</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
<label style="background: var(--fill); border-radius: 14px; padding: 10px 14px; display: flex; flex-direction: column; gap: 2px">
<span style="font-size: 12px; color: var(--text2)">Spat</span>
<input type="time" value="${draft.bed}" data-action="bed" style="border: 0; background: transparent; padding: 0; font: inherit; font-size: 20px; font-weight: 600; color: var(--text); outline: none">
</label>
<label style="background: var(--fill); border-radius: 14px; padding: 10px 14px; display: flex; flex-direction: column; gap: 2px">
<span style="font-size: 12px; color: var(--text2)">Vstal</span>
<input type="time" value="${draft.wake}" data-action="wake" style="border: 0; background: transparent; padding: 0; font: inherit; font-size: 20px; font-weight: 600; color: var(--text); outline: none">
</label>
</div>
<div style="display: flex; align-items: center; justify-content: space-between">
<span style="font-size: 14px; color: var(--text2)">Kakovost spanca</span>
<div role="radiogroup" aria-label="Kakovost spanca" style="display: flex; gap: 6px">${qualityHtml}</div>
</div>
</section>

<section aria-labelledby="h-pocutje" style="background: var(--card); border-radius: 22px; padding: 18px; display: flex; flex-direction: column; gap: 16px; box-shadow: var(--shadow)">
<h2 id="h-pocutje" style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--mood)">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"></path></svg>
Kako se počutiš?
</h2>
<div role="radiogroup" aria-label="Počutje" style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px">${moodHtml}</div>
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; justify-content: space-between; font-size: 14px">
<label for="energija" style="color: var(--text2)">Energija</label>
<span style="font-weight: 600">${draft.energy}/10</span>
</div>
<input id="energija" type="range" min="1" max="10" value="${draft.energy}" data-action="energy" style="width: 100%; margin: 0; accent-color: var(--accent)">
</div>
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; justify-content: space-between; font-size: 14px">
<label for="stres" style="color: var(--text2)">Stres</label>
<span style="font-weight: 600">${draft.stress}/10</span>
</div>
<input id="stres" type="range" min="1" max="10" value="${draft.stress}" data-action="stress" style="width: 100%; margin: 0; accent-color: var(--accent)">
</div>
<label style="display: flex; flex-direction: column; gap: 6px">
<span style="font-size: 14px; color: var(--text2)">Opomba</span>
<textarea rows="2" placeholder="Kako je minil dan?" data-action="note" style="border: 0; border-radius: 14px; background: var(--fill); padding: 12px 14px; font: inherit; font-size: 15px; color: var(--text); resize: none; outline: none">${draft.note || ''}</textarea>
</label>
</section>

<button type="button" data-action="save" style="height: 54px; border: 0; border-radius: 16px; background: var(--accent); color: var(--onAccent); font: inherit; font-size: 16px; font-weight: 600; cursor: pointer">Shrani vnos</button>
</main>`;

    wire();
  }

  function wire() {
    root.querySelector('[data-action="prevDay"]').addEventListener('click', () => {
      selectedDate = addDays(selectedDate, -1);
      loadDraft();
      render();
    });
    const nextBtn = root.querySelector('[data-action="nextDay"]');
    if (!nextBtn.disabled) nextBtn.addEventListener('click', () => {
      selectedDate = addDays(selectedDate, 1);
      loadDraft();
      render();
    });
    root.querySelector('[data-action="wDown"]').addEventListener('click', () => { draft.weight = Math.round((draft.weight - 0.1) * 10) / 10; persist(); render(); });
    root.querySelector('[data-action="wUp"]').addEventListener('click', () => { draft.weight = Math.round((draft.weight + 0.1) * 10) / 10; persist(); render(); });
    root.querySelector('[data-action="bed"]').addEventListener('change', (e) => { draft.bed = e.target.value; persist(); render(); });
    root.querySelector('[data-action="wake"]').addEventListener('change', (e) => { draft.wake = e.target.value; persist(); render(); });
    root.querySelectorAll('[data-action="quality"]').forEach(btn => btn.addEventListener('click', () => { draft.quality = Number(btn.getAttribute('data-v')); persist(); render(); }));
    root.querySelectorAll('[data-action="mood"]').forEach(btn => btn.addEventListener('click', () => { draft.mood = Number(btn.getAttribute('data-v')); persist(); render(); }));
    root.querySelector('[data-action="energy"]').addEventListener('change', (e) => { draft.energy = Number(e.target.value); persist(); render(); });
    root.querySelector('[data-action="stress"]').addEventListener('change', (e) => { draft.stress = Number(e.target.value); persist(); render(); });
    root.querySelector('[data-action="note"]').addEventListener('change', (e) => { draft.note = e.target.value; persist(); });
    root.querySelector('[data-action="save"]').addEventListener('click', () => {
      persist();
      ctx.navigate('home');
    });
  }

  loadDraft();
  render();
}
