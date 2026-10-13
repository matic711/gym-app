import { store } from '../state.js';
import { computeReminders, logStreak } from '../reminders.js';
import { formReport } from '../analysis.js';
import { pendingReport } from '../reports.js';
import { isoDate, addDays, startOfWeek, fromIso, fmtWeekday, fmtDate, fmtNum, fmtNum1, workoutVolume, workoutSetCount } from '../util.js';

const MOOD_LABELS = ['Slabo', 'Meh', 'V redu', 'Dobro', 'Odlično'];

function treningWord(n) {
  const m = n % 100;
  if (m === 1) return 'trening';
  if (m === 2) return 'treninga';
  if (m === 3 || m === 4) return 'treningi';
  return 'treningov';
}

function relDay(iso, today) {
  const days = Math.round((startOfDay(today) - fromIso(iso)) / 86400000);
  if (days <= 0) return 'Danes';
  if (days === 1) return 'Včeraj';
  return `Pred ${days} dnevi`;
}

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

function findRecentWeight(data, todayIso) {
  let d = todayIso;
  for (let i = 0; i < 14; i++) {
    const entry = data.wellness[d];
    if (entry && entry.weight != null) return { iso: d, weight: entry.weight };
    d = isoDate(addDays(new Date(d), -1));
  }
  return null;
}

function computeViewModel() {
  const data = store.data;
  const today = new Date();
  const todayIso = isoDate(today);
  const weekStart = startOfWeek(today);
  const weekStartIso = isoDate(weekStart);
  const weekEndIso = isoDate(addDays(weekStart, 6));

  const weekWorkouts = data.workouts.filter(w => w.dateISO >= weekStartIso && w.dateISO <= weekEndIso);
  const goal = data.settings.goalPerWeek;
  const done = weekWorkouts.length;
  const ratio = Math.min(1, goal ? done / goal : 0);
  const circumference = 2 * Math.PI * 34;
  const dash = (ratio * circumference).toFixed(1);
  const remaining = Math.max(0, goal - done);
  const remainingWord = remaining === 1 ? 'en' : String(remaining);
  const goalMsg = remaining <= 0 ? 'Tedenski cilj dosežen' : `Še ${remainingWord} ${treningWord(remaining)} do cilja`;

  const sortedWorkouts = [...data.workouts].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  const lastWorkout = sortedWorkouts[0] || null;

  let nextCard;
  if (data.activeWorkout) {
    nextCard = {
      label: 'Trening v teku',
      title: data.activeWorkout.name,
      meta: `${data.activeWorkout.exercises.length} vaj · v teku`,
      cta: 'Nadaljuj',
      target: 'nov'
    };
  } else {
    const tpl = data.templates[0];
    nextCard = tpl ? {
      label: 'Naslednji trening',
      title: tpl.summary ? `${tpl.name} · ${tpl.summary}` : tpl.name,
      meta: `${tpl.exercises.length} vaj · ~${Math.round(tpl.exercises.length * 9.2)} min · predloga`,
      cta: 'Začni',
      target: 'nov',
      params: { template: tpl.id }
    } : null;
  }

  const recentWeight = findRecentWeight(data, todayIso);
  const weekAgoIso = isoDate(addDays(today, -7));
  const weekAgoEntry = data.wellness[weekAgoIso];
  const weightDelta = recentWeight && weekAgoEntry ? recentWeight.weight - weekAgoEntry.weight : null;

  const todayWellness = data.wellness[todayIso];
  const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };
  let sleepDur = null;
  if (todayWellness) {
    let dur = toMin(todayWellness.wake) - toMin(todayWellness.bed);
    if (dur < 0) dur += 1440;
    sleepDur = dur;
  }

  const weekVolume = weekWorkouts.reduce((sum, w) => sum + workoutVolume(w), 0);

  return {
    weekdayLabel: fmtWeekday(today), dateLabel: fmtDate(today),
    userInitial: (data.settings.userName || 'M').slice(0, 1).toUpperCase(),
    dash, circumference: circumference.toFixed(1), done, goal, goalMsg,
    nextCard,
    weight: recentWeight ? fmtNum1(recentWeight.weight) : '—',
    weightDelta: weightDelta == null ? 'Ni dovolj podatkov' : `${weightDelta <= 0 ? '' : '+'}${fmtNum1(weightDelta)} kg ta teden`,
    sleepH: sleepDur == null ? '—' : Math.floor(sleepDur / 60), sleepM: sleepDur == null ? '' : sleepDur % 60,
    sleepQuality: todayWellness ? `Kakovost ${todayWellness.quality}/5` : 'Ni vnosa za danes',
    mood: todayWellness ? MOOD_LABELS[todayWellness.mood] : '—',
    energy: todayWellness ? `Energija ${todayWellness.energy}/10` : 'Ni vnosa za danes',
    volume: fmtNum(weekVolume),
    volumeMeta: `Ta teden · ${done} ${treningWord(done)}`,
    reminders: computeReminders(data, today),
    report: pendingReport(data, today),
    formWarning: (() => {
      const rep = formReport(data, today);
      if (!rep.slacking) return null;
      const items = rep.items.filter(i => i.level === 'bad' || i.level === 'warn');
      return { title: items[0].title, text: items[0].text, more: items.length - 1 };
    })(),
    streak: logStreak(data, today),
    lastWorkout: lastWorkout ? {
      id: lastWorkout.id,
      name: lastWorkout.name,
      meta: `${relDay(lastWorkout.dateISO, today)} · ${lastWorkout.durationMin} min · ${lastWorkout.exercises.length} vaj`
    } : null
  };
}

function template(vm) {
  const nextCardHtml = vm.nextCard ? `
<section style="background: var(--card); border-radius: 22px; padding: 18px; display: flex; align-items: center; gap: 14px; box-shadow: var(--shadow)">
<div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1">
<div style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accentText)">${vm.nextCard.label}</div>
<div style="font-size: 19px; font-weight: 600; letter-spacing: -0.01em">${vm.nextCard.title}</div>
<div style="font-size: 13px; color: var(--text2)">${vm.nextCard.meta}</div>
</div>
<a href="#" data-action="startNext" style="height: 44px; padding: 0 18px; border-radius: 22px; background: var(--accent); color: var(--onAccent); display: flex; align-items: center; gap: 6px; text-decoration: none; font-size: 15px; font-weight: 600">
<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"></path></svg>
${vm.nextCard.cta}
</a>
</section>` : '';

  const lastWorkoutHtml = vm.lastWorkout ? `
<a href="#/uredi?id=${encodeURIComponent(vm.lastWorkout.id)}" style="background: var(--card); border-radius: 20px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; text-decoration: none; color: var(--text); box-shadow: var(--shadow)">
<div style="width: 44px; height: 44px; border-radius: 14px; background: var(--accentSoft); color: var(--accentText); display: flex; align-items: center; justify-content: center">
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"></path></svg>
</div>
<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1">
<div style="font-size: 15px; font-weight: 600">Zadnji trening · ${vm.lastWorkout.name}</div>
<div style="font-size: 13px; color: var(--text2)">${vm.lastWorkout.meta}</div>
</div>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: var(--text2)"><path d="M9 6l6 6-6 6"></path></svg>
</a>` : '';

  const flame = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21c-3.9 0-7-2.8-7-6.6 0-3.1 2.1-5.2 3.6-7 .4 1.9 1.4 3 2.6 3.6C11 7.7 12.4 5 14.6 3c.3 3 4.4 5.6 4.4 11.4 0 3.8-3.1 6.6-7 6.6z"></path></svg>';
  const streakHtml = vm.streak > 1 ? `<span style="display: inline-flex; align-items: center; gap: 4px; color: var(--mood); font-size: 13px; font-weight: 600">${flame}${vm.streak} dni zapored</span>` : '';
  const remindersHtml = vm.reminders.length ? `
<section aria-labelledby="za-vpisati" style="background: var(--card); border-radius: 22px; padding: 14px 16px 6px; display: flex; flex-direction: column; box-shadow: var(--shadow)">
<div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 4px">
<h2 id="za-vpisati" style="margin: 0; font-size: 15px; font-weight: 600">Za vpisati</h2>
${streakHtml}
</div>
${vm.reminders.map((r, i) => `
<div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; ${i ? 'border-top: 1px solid var(--line);' : ''}">
<span aria-hidden="true" style="width: 10px; height: 10px; border-radius: 5px; flex-shrink: 0; background: ${r.urgent ? 'var(--danger)' : 'var(--accent)'}"></span>
<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0">
<div style="font-size: 15px; font-weight: 600">${r.title}</div>
<div style="font-size: 13px; color: var(--text2)">${r.sub}</div>
</div>
<a href="#/${r.route}${r.params ? '?' + new URLSearchParams(r.params) : ''}" style="height: 36px; padding: 0 14px; border-radius: 18px; flex-shrink: 0; display: flex; align-items: center; text-decoration: none; font-size: 14px; font-weight: 600; ${r.urgent ? 'background: var(--accent); color: var(--onAccent);' : 'background: var(--accentSoft); color: var(--accentText);'}">${r.cta}</a>
</div>`).join('')}
</section>` : `
<section style="background: var(--card); border-radius: 22px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; box-shadow: var(--shadow)">
<div style="width: 36px; height: 36px; border-radius: 18px; background: var(--fill); color: var(--good); display: flex; align-items: center; justify-content: center; flex-shrink: 0">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>
</div>
<div style="font-size: 15px; font-weight: 600; flex-grow: 1">Vse je vpisano</div>
${streakHtml}
</section>`;

  return `
<main style="padding: 28px 20px 0; display: flex; flex-direction: column; gap: 14px">
<header style="display: flex; align-items: flex-end; justify-content: space-between; padding-bottom: 4px">
<div style="display: flex; flex-direction: column; gap: 4px">
<div style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text2)">${vm.weekdayLabel}, ${vm.dateLabel}</div>
<h1 style="margin: 0; font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">Domov</h1>
</div>
<a href="#/nastavitve" aria-label="Profil in nastavitve" style="width: 44px; height: 44px; border-radius: 22px; background: var(--accentSoft); color: var(--accentText); display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 16px; font-weight: 700">${vm.userInitial}</a>
</header>

${remindersHtml}

${vm.report ? `
<a href="#/porocilo?kind=${vm.report.kind}&date=${vm.report.startIso}" style="background: var(--accent); color: var(--onAccent); border-radius: 22px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; text-decoration: none; box-shadow: var(--shadow)">
<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0"><path d="M5 20V10M12 20V4M19 20v-7"></path></svg>
<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0">
<div style="font-size: 15px; font-weight: 700">${vm.report.kind === 'month' ? 'Mesečno' : 'Tedensko'} poročilo je pripravljeno</div>
<div style="font-size: 13px; opacity: 0.85">${vm.report.label}</div>
</div>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0"><path d="M9 6l6 6-6 6"></path></svg>
</a>` : ''}

${vm.formWarning ? `
<a href="#/forma" style="background: var(--card); border-radius: 22px; padding: 14px 16px; display: flex; gap: 12px; align-items: flex-start; text-decoration: none; color: var(--text); box-shadow: var(--shadow); border-left: 4px solid var(--danger)">
<div style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1; min-width: 0">
<div style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--danger)">Opozorilo · forma</div>
<div style="font-size: 15px; font-weight: 600">${vm.formWarning.title}</div>
<div style="font-size: 13px; color: var(--text2)">${vm.formWarning.text}${vm.formWarning.more ? ` (+${vm.formWarning.more} več)` : ''}</div>
</div>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: var(--text2); flex-shrink: 0; margin-top: 2px"><path d="M9 6l6 6-6 6"></path></svg>
</a>` : ''}

<section style="background: var(--card); border-radius: 22px; padding: 18px; display: flex; align-items: center; gap: 18px; box-shadow: var(--shadow)">
<svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
<circle cx="42" cy="42" r="34" fill="none" style="stroke: var(--fill)" stroke-width="10"></circle>
<circle cx="42" cy="42" r="34" fill="none" style="stroke: var(--accent)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${vm.dash} ${vm.circumference}" transform="rotate(-90 42 42)"></circle>
</svg>
<div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1">
<div style="font-size: 13px; font-weight: 600; color: var(--text2)">Tedenski cilj</div>
<div style="font-size: 26px; font-weight: 700; letter-spacing: -0.02em">${vm.done} <span style="font-size: 17px; font-weight: 500; color: var(--text2)">od ${vm.goal} treningov</span></div>
<div style="font-size: 13px; color: var(--text2)">${vm.goalMsg}</div>
</div>
</section>

${nextCardHtml}

<div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 2px 0">
<h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em">Danes</h2>
<a href="#/zdravje" style="font-size: 15px; font-weight: 600; color: var(--accentText); text-decoration: none; padding: 10px 0">Vpiši</a>
</div>

<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">
<article style="background: var(--card); border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: center; gap: 6px; color: var(--accentText); font-size: 13px; font-weight: 600">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"></rect><path d="M8.5 10.5a3.5 3.5 0 0 1 7 0M12 10.5l1.5-2"></path></svg>
Teža
</div>
<div style="font-size: 26px; font-weight: 700; letter-spacing: -0.02em">${vm.weight} <span style="font-size: 15px; font-weight: 500; color: var(--text2)">kg</span></div>
<div style="font-size: 12px; color: var(--text2)">${vm.weightDelta}</div>
</article>
<article style="background: var(--card); border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: center; gap: 6px; color: var(--sleep); font-size: 13px; font-weight: 600">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path></svg>
Spanec
</div>
<div style="font-size: 26px; font-weight: 700; letter-spacing: -0.02em">${vm.sleepH} <span style="font-size: 15px; font-weight: 500; color: var(--text2)">h</span> ${vm.sleepM} <span style="font-size: 15px; font-weight: 500; color: var(--text2)">min</span></div>
<div style="font-size: 12px; color: var(--text2)">${vm.sleepQuality}</div>
</article>
<article style="background: var(--card); border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: center; gap: 6px; color: var(--mood); font-size: 13px; font-weight: 600">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"></path></svg>
Počutje
</div>
<div style="font-size: 26px; font-weight: 700; letter-spacing: -0.02em">${vm.mood}</div>
<div style="font-size: 12px; color: var(--text2)">${vm.energy}</div>
</article>
<article style="background: var(--card); border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: center; gap: 6px; color: var(--good); font-size: 13px; font-weight: 600">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"></path></svg>
Volumen
</div>
<div style="font-size: 26px; font-weight: 700; letter-spacing: -0.02em">${vm.volume} <span style="font-size: 15px; font-weight: 500; color: var(--text2)">kg</span></div>
<div style="font-size: 12px; color: var(--text2)">${vm.volumeMeta}</div>
</article>
</div>

${lastWorkoutHtml}
</main>`;
}

export function mount(root, ctx) {
  function render() {
    const vm = computeViewModel();
    root.innerHTML = template(vm);
    root.querySelector('[data-action="startNext"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      const data = store.data;
      if (data.activeWorkout) { ctx.navigate('nov'); return; }
      const tpl = data.templates[0];
      ctx.navigate('nov', tpl ? { template: tpl.id } : undefined);
    });
  }
  render();
  return store.subscribe(render);
}
