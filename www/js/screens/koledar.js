import { store } from '../state.js';
import { isoDate, addDays, fromIso, startOfWeek, fmtWeekday, fmtDate, fmtNum, fmtNum1, workoutVolume, escapeHtml, plural, MONTHS, DOW_SHORT } from '../util.js';
import { sessionPerformances, sleepMinutes, pct, hm } from '../analysis.js';

const MOOD_LABELS = ['Slabo', 'Meh', 'V redu', 'Dobro', 'Odlično'];

function fmtKg(kg) {
  kg = Number(kg) || 0;
  return Number.isInteger(kg) ? fmtNum(kg) : fmtNum1(kg);
}

function monthGrid(month, data, selectedIso, todayIso) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const workoutDays = new Set(data.workouts.map(w => w.dateISO));
  const cells = [];
  for (let d = startOfWeek(first); d <= last || cells.length % 7; d = addDays(d, 1)) {
    const iso = isoDate(d);
    const inMonth = d.getMonth() === month.getMonth();
    const workout = workoutDays.has(iso);
    const logged = !!data.wellness[iso];
    const selected = iso === selectedIso, today = iso === todayIso, future = iso > todayIso;
    let numStyle = 'width: 36px; height: 36px; border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 15px; box-sizing: border-box;';
    if (selected) numStyle += ' background: var(--accent); color: var(--onAccent); font-weight: 700;';
    else if (workout) numStyle += ' background: var(--accentSoft); color: var(--accentText); font-weight: 700;';
    else numStyle += ` color: ${inMonth && !future ? 'var(--text)' : 'var(--text2)'}; font-weight: 500;`;
    if (today && !selected) numStyle += ' box-shadow: inset 0 0 0 2px var(--accent);';
    if (!inMonth) numStyle += ' opacity: 0.45;';
    const label = `${fmtDate(d)}${workout ? ', trening' : ''}${logged ? ', vpisano počutje' : ''}`;
    cells.push(`<button type="button" data-date="${iso}" aria-label="${label}" aria-pressed="${selected}" style="border: 0; background: transparent; padding: 2px 0; display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; font: inherit; color: inherit">
<span style="${numStyle}">${d.getDate()}</span>
<span style="width: 5px; height: 5px; border-radius: 3px; background: ${logged ? 'var(--mood)' : 'transparent'}"></span>
</button>`);
  }
  return cells.join('');
}

function monthSummary(month, data) {
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-`;
  const workouts = data.workouts.filter(w => w.dateISO.startsWith(prefix));
  const entries = Object.entries(data.wellness).filter(([iso]) => iso.startsWith(prefix)).map(([, e]) => e);
  const sleeps = entries.map(sleepMinutes).filter(v => v != null);
  const avgSleep = sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null;
  return { workouts: workouts.length, logged: entries.length, avgSleep };
}

function tile(label, value, sub) {
  return `<div style="background: var(--fill); border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0">
<span style="font-size: 12px; color: var(--text2)">${label}</span>
<span style="font-size: 16px; font-weight: 700">${value}</span>
${sub ? `<span style="font-size: 12px; color: var(--text2)">${sub}</span>` : ''}
</div>`;
}

function wellnessHtml(e, iso, todayIso) {
  const editHref = `#/zdravje?date=${iso}&from=koledar`;
  const head = (action) => `<div style="display: flex; align-items: center; justify-content: space-between">
<h3 style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--mood)">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"></path></svg>
Počutje
</h3>
${action}
</div>`;
  const card = inner => `<section style="background: var(--card); border-radius: 22px; padding: 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow)">${inner}</section>`;

  if (!e) {
    if (iso > todayIso) return card(head('') + '<div style="font-size: 14px; color: var(--text2)">Ta dan še ni prišel.</div>');
    return card(head(`<a href="${editHref}" style="height: 36px; padding: 0 14px; border-radius: 18px; background: var(--accent); color: var(--onAccent); display: flex; align-items: center; text-decoration: none; font-size: 14px; font-weight: 600">Vpiši</a>`) +
      '<div style="font-size: 14px; color: var(--text2)">Ta dan ni vpisa.</div>');
  }
  const sleep = sleepMinutes(e);
  return card(head(`<a href="${editHref}" style="font-size: 15px; font-weight: 600; color: var(--accentText); text-decoration: none; padding: 6px 0">Uredi</a>`) + `
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
${tile('Teža', e.weight != null ? `${fmtNum1(e.weight)} kg` : '—')}
${tile('Spanec', sleep != null ? hm(sleep) : '—', e.bed && e.wake ? `${e.bed}–${e.wake} · kakovost ${e.quality}/5` : '')}
${tile('Počutje', e.mood != null ? MOOD_LABELS[e.mood] : '—')}
${tile('Energija · stres', `${e.energy ?? '—'}/10 · ${e.stress ?? '—'}/10`)}
</div>
${e.note ? `<div style="font-size: 14px; background: var(--fill); border-radius: 14px; padding: 10px 12px">${escapeHtml(e.note)}</div>` : ''}`);
}

function workoutHtml(w, perf) {
  const sets = w.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  const formChip = perf ? `<span style="padding: 3px 9px; border-radius: 999px; background: var(--fill); font-size: 12px; font-weight: 700; color: ${perf.perf >= 0 ? 'var(--good)' : 'var(--danger)'}">Forma ${pct(perf.perf)}</span>` : '';
  const exHtml = w.exercises.map((ex, i) => `
<div style="padding: 10px 0; ${i ? 'border-top: 1px solid var(--line);' : ''}">
<a href="#/vaja?name=${encodeURIComponent(ex.name)}" style="font-size: 15px; font-weight: 600; color: var(--text); text-decoration: none">${escapeHtml(ex.name)}</a>
<div style="font-size: 13px; color: var(--text2); overflow-wrap: anywhere">${ex.sets.map(s => `${fmtKg(s.kg)}×${s.reps}`).join(' · ')}</div>
</div>`).join('');
  return `<section style="background: var(--card); border-radius: 22px; padding: 16px 16px 6px; display: flex; flex-direction: column; gap: 6px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px">
<div style="display: flex; flex-direction: column; gap: 3px; min-width: 0">
<h3 style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--accentText)">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"></path></svg>
${escapeHtml(w.name)}
</h3>
<div style="font-size: 13px; color: var(--text2)">${w.durationMin} min · ${plural(w.exercises.length, ['vaja', 'vaji', 'vaje', 'vaj'])} · ${plural(sets, ['serija', 'seriji', 'serije', 'serij'])} · ${fmtNum(workoutVolume(w))} kg</div>
</div>
<a href="#/uredi?id=${encodeURIComponent(w.id)}" style="font-size: 15px; font-weight: 600; color: var(--accentText); text-decoration: none; padding: 2px 0; flex-shrink: 0">Uredi</a>
</div>
${formChip ? `<div>${formChip}</div>` : ''}
<div>${exHtml}</div>
</section>`;
}

function template(state) {
  const data = store.data;
  const today = new Date();
  const todayIso = isoDate(today);
  const { month, selectedIso } = state;
  const selDate = fromIso(selectedIso);
  const sum = monthSummary(month, data);
  const atCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const perfById = new Map(sessionPerformances(data).map(p => [p.id, p]));
  const dayWorkouts = data.workouts.filter(w => w.dateISO === selectedIso);
  const monthName = MONTHS[month.getMonth()];

  const navBtn = (action, label, path, disabled) => `<button type="button" data-action="${action}" aria-label="${label}" ${disabled ? 'disabled' : ''} style="width: 44px; height: 44px; border: 0; border-radius: 22px; background: var(--fill); color: ${disabled ? 'var(--text2)' : 'var(--accentText)'}; display: flex; align-items: center; justify-content: center; cursor: ${disabled ? 'default' : 'pointer'}; opacity: ${disabled ? 0.5 : 1}">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"></path></svg>
</button>`;

  return `
<main style="padding: 28px 20px 0; display: flex; flex-direction: column; gap: 16px">
<header style="display: flex; align-items: flex-end; justify-content: space-between">
<h1 style="margin: 0; font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">Koledar</h1>
${selectedIso !== todayIso ? `<button type="button" data-action="today" style="height: 36px; padding: 0 14px; border: 0; border-radius: 18px; background: var(--accentSoft); color: var(--accentText); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer">Danes</button>` : ''}
</header>

<section style="background: var(--card); border-radius: 22px; padding: 14px 12px 12px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: center; justify-content: space-between; padding: 0 2px">
${navBtn('prevMonth', 'Prejšnji mesec', 'M15 5l-7 7 7 7', false)}
<div style="display: flex; flex-direction: column; align-items: center; gap: 2px">
<div style="font-size: 17px; font-weight: 700; text-transform: capitalize">${monthName} ${month.getFullYear()}</div>
<div style="font-size: 12px; color: var(--text2)">${plural(sum.workouts, ['trening', 'treninga', 'treningi', 'treningov'])} · ${plural(sum.logged, ['vpis', 'vpisa', 'vpisi', 'vpisov'])}${sum.avgSleep != null ? ` · spanec ${hm(sum.avgSleep)}` : ''}</div>
</div>
${navBtn('nextMonth', 'Naslednji mesec', 'M9 5l7 7-7 7', atCurrentMonth)}
</div>
<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); text-align: center; font-size: 11px; font-weight: 600; color: var(--text2)">
${DOW_SHORT.map(l => `<div>${l}</div>`).join('')}
</div>
<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 2px">
${monthGrid(month, data, selectedIso, todayIso)}
</div>
<div style="display: flex; justify-content: center; gap: 16px; font-size: 12px; color: var(--text2); padding-top: 2px">
<span style="display: flex; align-items: center; gap: 6px"><span style="width: 12px; height: 12px; border-radius: 6px; background: var(--accentSoft); box-shadow: inset 0 0 0 1px var(--accent)"></span>Trening</span>
<span style="display: flex; align-items: center; gap: 6px"><span style="width: 6px; height: 6px; border-radius: 3px; background: var(--mood)"></span>Vpis počutja</span>
</div>
</section>

<h2 id="day-overview" style="margin: 6px 2px 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em">${fmtWeekday(selDate)}, ${fmtDate(selDate)}</h2>
${wellnessHtml(data.wellness[selectedIso], selectedIso, todayIso)}
${dayWorkouts.length ? dayWorkouts.map(w => workoutHtml(w, perfById.get(w.id))).join('') : `
<section style="background: var(--card); border-radius: 22px; padding: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-shadow: var(--shadow)">
<div style="font-size: 14px; color: var(--text2)">${selectedIso > todayIso ? 'Ni načrtovanega treninga.' : 'Ta dan ni treninga.'}</div>
${selectedIso === todayIso ? `<a href="#/trening" style="height: 36px; padding: 0 14px; border-radius: 18px; background: var(--accentSoft); color: var(--accentText); display: flex; align-items: center; text-decoration: none; font-size: 14px; font-weight: 600; flex-shrink: 0">Trening</a>` : ''}
</section>`}
</main>`;
}

export function mount(root, ctx) {
  const today = new Date();
  const p = ctx.params.date;
  const start = /^\d{4}-\d{2}-\d{2}$/.test(p || '') ? fromIso(p) : today;
  const state = { selectedIso: isoDate(start), month: new Date(start.getFullYear(), start.getMonth(), 1) };

  function select(iso, scroll) {
    state.selectedIso = iso;
    const d = fromIso(iso);
    state.month = new Date(d.getFullYear(), d.getMonth(), 1);
    // Remember the day so "back" from a workout or entry returns here.
    history.replaceState(null, '', `#/koledar?date=${iso}`);
    render();
    if (scroll) {
      const el = root.querySelector('#day-overview');
      if (el && el.getBoundingClientRect().top > window.innerHeight - 160) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function render() {
    root.innerHTML = template(state);
    root.querySelectorAll('[data-date]').forEach(b => b.addEventListener('click', () => select(b.dataset.date, true)));
    root.querySelector('[data-action="prevMonth"]').addEventListener('click', () => {
      state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
      render();
    });
    const next = root.querySelector('[data-action="nextMonth"]');
    if (!next.disabled) next.addEventListener('click', () => {
      state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
      render();
    });
    root.querySelector('[data-action="today"]')?.addEventListener('click', () => select(isoDate(new Date()), false));
  }

  render();
  return store.subscribe(render);
}
