import { store } from '../state.js';
import { isoDate, addDays, startOfWeek, fromIso, DOW_SHORT, fmtDateShort, fmtNum, workoutVolume } from '../util.js';

const DOW_ABBR = ['pon', 'tor', 'sre', 'čet', 'pet', 'sob', 'ned'];

function computeViewModel() {
  const data = store.data;
  const today = new Date();
  const todayIso = isoDate(today);
  const weekStart = startOfWeek(today);

  const base = 'width: 36px; height: 36px; border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; box-sizing: border-box;';
  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const iso = isoDate(d);
    const hasWorkout = data.workouts.some(w => w.dateISO === iso);
    const isToday = iso === todayIso;
    const style = base + (hasWorkout ? ' background: var(--accent); color: var(--onAccent);' : isToday ? ' border: 2px solid var(--accent); color: var(--accentText);' : ' color: var(--text2);');
    week.push({ l: DOW_SHORT[i], n: d.getDate(), style });
  }

  const monLabel = fmtDateShort(weekStart);
  const sunLabel = fmtDateShort(addDays(weekStart, 6));

  const sorted = [...data.workouts].sort((a, b) => b.dateISO.localeCompare(a.dateISO)).slice(0, 12);
  const history = sorted.map((w, i) => {
    const d = fromIso(w.dateISO);
    const setCount = w.exercises.reduce((s, ex) => s + ex.sets.length, 0);
    return {
      id: w.id,
      dow: DOW_ABBR[(d.getDay() + 6) % 7], day: d.getDate(),
      name: w.name,
      meta: `${w.durationMin} min · ${w.exercises.length} vaj · ${setCount} serij`,
      vol: fmtNum(workoutVolume(w)) + ' kg',
      border: i ? 'border-top: 1px solid var(--line);' : ''
    };
  });

  return { week, monLabel, sunLabel, history };
}

function template(vm) {
  const weekHtml = vm.week.map(d => `
<div style="display: flex; flex-direction: column; align-items: center; gap: 6px">
<div style="font-size: 11px; font-weight: 600; color: var(--text2)">${d.l}</div>
<div style="${d.style}">${d.n}</div>
</div>`).join('');

  const historyHtml = vm.history.length ? vm.history.map(h => `
<div style="display: flex; align-items: center; gap: 4px; padding: 0 8px 0 0; color: var(--text); ${h.border}">
<a href="#/uredi?id=${encodeURIComponent(h.id)}" aria-label="Uredi trening ${h.name}" style="display: flex; align-items: center; gap: 14px; padding: 14px 4px 14px 16px; flex-grow: 1; min-width: 0; color: inherit; text-decoration: none">
<div style="width: 44px; height: 44px; border-radius: 14px; background: var(--fill); display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0">
<div style="font-size: 10px; font-weight: 700; color: var(--text2); text-transform: uppercase">${h.dow}</div>
<div style="font-size: 16px; font-weight: 700; line-height: 1">${h.day}</div>
</div>
<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0">
<div style="font-size: 15px; font-weight: 600">${h.name}</div>
<div style="font-size: 13px; color: var(--text2)">${h.meta}</div>
</div>
<div style="font-size: 14px; font-weight: 600; color: var(--text2); flex-shrink: 0">${h.vol}</div>
</a>
<button type="button" data-action="deleteWorkout" data-id="${h.id}" aria-label="Izbriši trening ${h.name}" style="width: 36px; height: 36px; border: 0; border-radius: 18px; background: transparent; color: var(--text2); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0">
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M10 11v7M14 11v7"></path></svg>
</button>
</div>`).join('') : `
<div style="padding: 32px 16px; text-align: center; color: var(--text2); font-size: 14px">Še ni zabeleženih treningov.</div>`;

  return `
<main style="padding: 28px 20px 0; display: flex; flex-direction: column; gap: 16px">
<header style="display: flex; align-items: flex-end; justify-content: space-between">
<h1 style="margin: 0; font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">Trening</h1>
<a href="#" data-action="newEmpty" aria-label="Nov trening" style="width: 44px; height: 44px; border-radius: 22px; background: var(--accent); color: var(--onAccent); display: flex; align-items: center; justify-content: center; text-decoration: none">
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
</a>
</header>

<div role="tablist" aria-label="Pogled" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 4px; background: var(--fill); border-radius: 12px">
<a href="#/trening" role="tab" aria-selected="true" style="height: 36px; border-radius: 9px; background: var(--card); color: var(--text); display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 14px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.08)">Treningi</a>
<a href="#/predloge" role="tab" aria-selected="false" style="height: 36px; border-radius: 9px; color: var(--text2); display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 14px; font-weight: 600">Predloge</a>
</div>

<section style="background: var(--card); border-radius: 22px; padding: 16px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: center; justify-content: space-between">
<div style="font-size: 15px; font-weight: 600">Ta teden</div>
<div style="font-size: 13px; color: var(--text2)">${vm.monLabel}–${vm.sunLabel}</div>
</div>
<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px">
${weekHtml}
</div>
</section>

<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">
<a href="#" data-action="newEmpty" style="height: 52px; border-radius: 16px; background: var(--accent); color: var(--onAccent); display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; font-size: 15px; font-weight: 600">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
Prazen trening
</a>
<a href="#/predloge" style="height: 52px; border-radius: 16px; background: var(--accentSoft); color: var(--accentText); display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; font-size: 15px; font-weight: 600">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M8 9h8M8 13h8M8 17h5"></path></svg>
Iz predloge
</a>
</div>

<h2 style="margin: 6px 2px 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em">Zgodovina</h2>
<section style="background: var(--card); border-radius: 22px; overflow: hidden; box-shadow: var(--shadow)">
${historyHtml}
</section>
</main>`;
}

export function mount(root, ctx) {
  function render() {
    root.innerHTML = template(computeViewModel());
    root.querySelectorAll('[data-action="newEmpty"]').forEach(el => el.addEventListener('click', (e) => {
      e.preventDefault();
      if (store.data.activeWorkout) { ctx.navigate('nov'); return; }
      ctx.navigate('nov', { blank: '1' });
    }));
    root.querySelectorAll('[data-action="deleteWorkout"]').forEach(el => el.addEventListener('click', () => {
      const id = el.getAttribute('data-id');
      const w = store.data.workouts.find(x => x.id === id);
      if (!w) return;
      if (!confirm(`Izbrišem trening "${w.name}"? Tega dejanja ni mogoče razveljaviti.`)) return;
      store.data.workouts = store.data.workouts.filter(x => x.id !== id);
      store.save();
    }));
  }
  render();
  return store.subscribe(render);
}
