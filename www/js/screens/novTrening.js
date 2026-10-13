import { store, uid, isoDate } from '../state.js';
import { fmtNum } from '../util.js';
import { openExercisePicker } from '../components/exercisePicker.js';
import { recommend } from '../progression.js';
import { plateauFor } from '../plateau.js';

const REC_COLORS = { up: 'var(--good)', reps: 'var(--accentText)', hold: 'var(--mood)', deload: 'var(--danger)' };
const REC_ICONS = { up: '↑', reps: '+1', hold: '=', deload: '↓' };

function fmtKgInput(kg) { return String(Math.round(kg * 100) / 100).replace('.', ','); }

function findPrevSet(data, exerciseName, setIndex) {
  const sorted = [...data.workouts].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  for (const w of sorted) {
    const ex = w.exercises.find(e => e.name.toLowerCase() === exerciseName.toLowerCase());
    if (ex && ex.sets[setIndex]) {
      const s = ex.sets[setIndex];
      return `${fmtKgInput(Number(s.kg) || 0)} × ${s.reps}`;
    }
  }
  return '—';
}

function ensureActiveWorkout(ctx) {
  const data = store.data;
  if (data.activeWorkout) return;

  let exercises = [];
  const tplId = ctx.params.template;
  let name = 'Nov trening';
  if (tplId) {
    const tpl = data.templates.find(t => t.id === tplId);
    if (tpl) {
      name = `${tpl.name} · ${tpl.summary}`;
      exercises = tpl.exercises.map(ex => ({
        name: ex.name, muscle: ex.muscle,
        sets: [0, 1, 2].map(() => ({ kg: '', reps: '', done: false }))
      }));
    }
  }
  data.activeWorkout = { id: uid(), name, startedAt: Date.now(), exercises };
  store.save();
}

function restSecToLabel(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatRestMs(ms) {
  const sec = Math.max(0, Math.round(ms / 1000));
  return restSecToLabel(sec);
}

function computeVals(data) {
  const w = data.activeWorkout;
  let volume = 0, doneCount = 0, setCount = 0;
  const rowBase = 'display: grid; grid-template-columns: 40px minmax(0, 1fr) 64px 56px 44px; gap: 8px; align-items: center; padding: 4px; border-radius: 12px;';
  const checkBase = 'width: 44px; height: 36px; border: 0; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer;';

  const exercises = w.exercises.map((ex, ei) => {
    const rec = recommend(data, ex.name);
    const plateau = rec ? plateauFor(data, ex.name) : null;
    const rows = ex.sets.map((s, si) => {
      setCount++;
      const kgNum = parseFloat(String(s.kg).replace(',', '.')) || 0;
      const repsNum = parseFloat(String(s.reps).replace(',', '.')) || 0;
      if (s.done) { doneCount++; volume += kgNum * repsNum; }
      const prev = findPrevSet(data, ex.name, si);
      const hint = prev.split(' × ');
      return {
        s, si,
        n: si + 1,
        prev,
        kgHint: rec ? fmtKgInput(rec.kg) : hint[0] === '—' ? '0' : hint[0],
        repHint: rec ? String(rec.reps[Math.min(si, rec.reps.length - 1)]) : hint[1] || '0',
        rowStyle: rowBase + (s.done ? ' background: var(--accentSoft);' : ''),
        checkStyle: checkBase + (s.done ? ' background: var(--accent); color: var(--onAccent);' : ' background: var(--fill); color: var(--text2);'),
        restBefore: null
      };
    });
    for (let i = 1; i < rows.length; i++) {
      const prevSet = rows[i - 1].s, curSet = rows[i].s;
      if (prevSet.doneAt && curSet.doneAt) {
        rows[i].restBefore = formatRestMs(curSet.doneAt - prevSet.doneAt);
      }
    }
    return { ex, ei, rows, rec, plateau };
  });

  return { exercises, volume: fmtNum(volume), doneCount, setCount };
}

function template(w, vm, restLabel) {
  const exercisesHtml = vm.exercises.map(({ ex, ei, rows, rec, plateau }) => `
<section style="background: var(--card); border-radius: 22px; padding: 16px 12px 12px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: center; justify-content: space-between; padding: 0 4px">
<div style="display: flex; flex-direction: column; gap: 2px">
<h2 style="margin: 0; font-size: 17px; font-weight: 600; color: var(--accentText)">${ex.name}</h2>
<div style="font-size: 12px; color: var(--text2)">${ex.muscle || ''}</div>
</div>
<button type="button" data-action="removeExercise" data-ei="${ei}" aria-label="Odstrani vajo" style="width: 44px; height: 44px; border: 0; border-radius: 22px; background: transparent; color: var(--text2); display: flex; align-items: center; justify-content: center; cursor: pointer">
<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>
</button>
</div>
${rec ? `
<div style="margin: 0 4px; padding: 10px 10px 10px 12px; border-radius: 12px; background: var(--fill); display: flex; align-items: center; gap: 10px">
<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0">
<div style="font-size: 14px; font-weight: 700; color: ${REC_COLORS[rec.type]}">${REC_ICONS[rec.type]} Predlog: ${rec.title}</div>
<div style="font-size: 12px; color: var(--text2)">${rec.reason}</div>
<div style="font-size: 12px; color: var(--text2)">${rec.note ? 'Osnova' : 'Zadnjič'}: ${rec.last}</div>
${rec.note ? `<div style="font-size: 12px; color: var(--mood)">${rec.note}</div>` : ''}
${plateau && !plateau.cut ? `<a href="#/vaja?name=${encodeURIComponent(ex.name)}" style="font-size: 12px; font-weight: 600; color: var(--mood); text-decoration: none">Plato ${plateau.weeks} t. — poglej predloge →</a>` : ''}
</div>
<button type="button" data-action="applyRec" data-ei="${ei}" style="height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: var(--accent); color: var(--onAccent); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; flex-shrink: 0">Uporabi</button>
</div>` : ''}
<div style="display: grid; grid-template-columns: 40px minmax(0, 1fr) 64px 56px 44px; gap: 8px; padding: 0 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text2)">
<div style="text-align: center">Ser.</div>
<div>Prejšnje</div>
<div style="text-align: center">kg</div>
<div style="text-align: center">Pon.</div>
<div style="text-align: center">✓</div>
</div>
${rows.map(r => `
${r.restBefore ? `
<div style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 2px 0; font-size: 12px; font-weight: 600; color: var(--text2)">
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 2M10 2h4"></path></svg>
Počitek ${r.restBefore}
</div>` : ''}
<div style="${r.rowStyle}">
<div style="text-align: center; font-size: 15px; font-weight: 700">${r.n}</div>
<div style="font-size: 14px; color: var(--text2)">${r.prev}</div>
<input type="text" inputmode="decimal" aria-label="Serija ${r.n}, teža v kg" data-field="kg" data-ei="${ei}" data-si="${r.si}" value="${r.s.kg}" placeholder="${r.kgHint}" style="height: 36px; width: 64px; box-sizing: border-box; border: 0; border-radius: 10px; background: var(--fill); text-align: center; font: inherit; font-size: 15px; font-weight: 600; color: var(--text); outline: none">
<input type="text" inputmode="numeric" aria-label="Serija ${r.n}, ponovitve" data-field="reps" data-ei="${ei}" data-si="${r.si}" value="${r.s.reps}" placeholder="${r.repHint}" style="height: 36px; width: 56px; box-sizing: border-box; border: 0; border-radius: 10px; background: var(--fill); text-align: center; font: inherit; font-size: 15px; font-weight: 600; color: var(--text); outline: none">
<button type="button" data-action="toggleSet" data-ei="${ei}" data-si="${r.si}" aria-label="Serija ${r.n}${r.s.done ? ' opravljena' : ' označi kot opravljeno'}" aria-pressed="${r.s.done}" style="${r.checkStyle}">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>
</button>
</div>`).join('')}
<button type="button" data-action="addSet" data-ei="${ei}" style="height: 40px; border: 0; border-radius: 12px; background: var(--fill); color: var(--text); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; margin: 4px 4px 0">+ Dodaj serijo</button>
</section>`).join('');

  return `
<header style="padding: 16px 12px 0 8px; display: flex; align-items: center; justify-content: space-between">
<a href="#/trening" style="height: 44px; padding: 0 8px; display: flex; align-items: center; gap: 2px; color: var(--accentText); text-decoration: none; font-size: 16px; font-weight: 500">
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>
Trening
</a>
<div id="workout-timer" style="height: 32px; padding: 0 12px; border-radius: 16px; background: var(--fill); display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 2M10 2h4"></path></svg>
<span data-timer-text>00:00</span>
</div>
</header>

<main style="padding: 8px 20px 0; display: flex; flex-direction: column; gap: 16px">
<div style="display: flex; flex-direction: column; gap: 6px">
<label for="ime-treninga" style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text2)">Ime treninga</label>
<input id="ime-treninga" type="text" value="${w.name}" data-field="title" style="border: 0; outline: none; background: transparent; padding: 0; font: inherit; font-size: 30px; font-weight: 700; letter-spacing: -0.02em; color: var(--text)">
</div>

<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px">
<div style="background: var(--card); border-radius: 16px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; box-shadow: var(--shadow)">
<div style="font-size: 12px; color: var(--text2)">Volumen</div>
<div style="font-size: 18px; font-weight: 700">${vm.volume} <span style="font-size: 12px; font-weight: 500; color: var(--text2)">kg</span></div>
</div>
<div style="background: var(--card); border-radius: 16px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; box-shadow: var(--shadow)">
<div style="font-size: 12px; color: var(--text2)">Serije</div>
<div style="font-size: 18px; font-weight: 700">${vm.doneCount} <span style="font-size: 12px; font-weight: 500; color: var(--text2)">/ ${vm.setCount}</span></div>
</div>
<div style="background: var(--card); border-radius: 16px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; box-shadow: var(--shadow)">
<div style="font-size: 12px; color: var(--text2)">Počitek</div>
<div style="font-size: 18px; font-weight: 700; color: var(--accentText)">${restLabel}</div>
</div>
</div>

${exercisesHtml}

<button type="button" data-action="addExercise" style="height: 52px; border: 0; border-radius: 16px; background: var(--accentSoft); color: var(--accentText); font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
Dodaj vajo
</button>
</main>

<footer style="position: fixed; bottom: 0; width: 100%; box-sizing: border-box; padding: 12px 20px calc(env(safe-area-inset-bottom, 0px) + 20px); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; background: var(--bar); border-top: 1px solid var(--line); max-width: 560px; margin: 0 auto; left: 50%; transform: translateX(-50%)">
<button type="button" data-action="saveTemplate" style="height: 52px; border: 0; border-radius: 16px; background: var(--fill); color: var(--text); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Shrani kot predlogo</button>
<button type="button" data-action="finish" style="height: 52px; border: 0; border-radius: 16px; background: var(--accent); color: var(--onAccent); display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 15px; font-weight: 600; cursor: pointer">Končaj trening</button>
</footer>`;
}

export function mount(root, ctx) {
  ensureActiveWorkout(ctx);
  root.style.paddingBottom = 'calc(96px + env(safe-area-inset-bottom, 0px) + 20px)';
  let timerInterval = null;

  function updateTimerText() {
    const w = store.data.activeWorkout;
    if (!w) return;
    const el = root.querySelector('[data-timer-text]');
    if (!el) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - w.startedAt) / 1000));
    const m = Math.floor(elapsed / 60), s = elapsed % 60;
    el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function render() {
    const w = store.data.activeWorkout;
    if (!w) { ctx.navigate('trening'); return; }
    const vm = computeVals(store.data);
    const restLabel = restSecToLabel(store.data.settings.defaultRestSec || 90);
    root.innerHTML = template(w, vm, restLabel);
    updateTimerText();
    wire();
  }

  function mutate(fn) {
    fn(store.data.activeWorkout);
    store.save();
  }

  function wire() {
    root.querySelector('#ime-treninga').addEventListener('change', (e) => {
      mutate(w => { w.name = e.target.value; });
    });
    root.querySelectorAll('input[data-field]').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const ei = Number(e.target.getAttribute('data-ei'));
        const si = Number(e.target.getAttribute('data-si'));
        const field = e.target.getAttribute('data-field');
        mutate(w => { w.exercises[ei].sets[si][field] = e.target.value; });
      });
    });
    root.querySelectorAll('[data-action="toggleSet"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ei = Number(btn.getAttribute('data-ei'));
        const si = Number(btn.getAttribute('data-si'));
        // Ticking an empty set accepts the suggested values shown as placeholders.
        const kgIn = root.querySelector(`input[data-field="kg"][data-ei="${ei}"][data-si="${si}"]`);
        const repIn = root.querySelector(`input[data-field="reps"][data-ei="${ei}"][data-si="${si}"]`);
        mutate(w => {
          const set = w.exercises[ei].sets[si];
          set.done = !set.done;
          set.doneAt = set.done ? Date.now() : undefined;
          if (set.done && Number(repIn?.placeholder) > 0) {
            if (String(set.kg).trim() === '') set.kg = kgIn.placeholder;
            if (String(set.reps).trim() === '') set.reps = repIn.placeholder;
          }
        });
      });
    });
    root.querySelectorAll('[data-action="applyRec"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ei = Number(btn.getAttribute('data-ei'));
        const rec = recommend(store.data, store.data.activeWorkout.exercises[ei].name);
        if (!rec) return;
        mutate(w => {
          const sets = w.exercises[ei].sets;
          while (sets.length < rec.sets) sets.push({ kg: '', reps: '', done: false });
          for (let i = 0; i < rec.sets; i++) {
            if (sets[i].done) continue;
            sets[i].kg = fmtKgInput(rec.kg);
            sets[i].reps = String(rec.reps[i]);
          }
        });
      });
    });
    root.querySelectorAll('[data-action="addSet"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ei = Number(btn.getAttribute('data-ei'));
        mutate(w => {
          const sets = w.exercises[ei].sets;
          const last = sets[sets.length - 1];
          sets.push({ kg: last ? last.kg : '', reps: '', done: false });
        });
      });
    });
    root.querySelectorAll('[data-action="removeExercise"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ei = Number(btn.getAttribute('data-ei'));
        mutate(w => { w.exercises.splice(ei, 1); });
      });
    });
    root.querySelector('[data-action="addExercise"]').addEventListener('click', () => {
      openExercisePicker({
        onPick: ({ name, muscle }) => {
          mutate(w => {
            w.exercises.push({ name, muscle, sets: [{ kg: '', reps: '', done: false }] });
          });
        }
      });
    });
    root.querySelector('[data-action="saveTemplate"]').addEventListener('click', () => {
      const w = store.data.activeWorkout;
      if (!w.exercises.length) return;
      const tplName = prompt('Ime predloge:', w.name) || w.name;
      store.data.templates.push({
        id: uid(),
        name: tplName,
        summary: w.exercises.slice(0, 3).map(e => e.muscle || e.name).join(', '),
        exercises: w.exercises.map(e => ({ name: e.name, muscle: e.muscle || '' }))
      });
      store.save();
      ctx.navigate('predloge');
    });
    root.querySelector('[data-action="finish"]').addEventListener('click', () => {
      const w = store.data.activeWorkout;
      if (!w.exercises.length) { if (!confirm('Trening nima vaj. Vseeno končaj?')) return; }
      const durationMin = Math.max(1, Math.round((Date.now() - w.startedAt) / 60000));
      store.data.workouts.push({
        id: w.id, dateISO: isoDate(new Date()), name: w.name || 'Trening',
        durationMin,
        exercises: w.exercises.map(ex => ({
          name: ex.name, muscle: ex.muscle || '',
          sets: ex.sets.filter(s => s.kg !== '' && s.reps !== '').map(s => ({ kg: parseFloat(String(s.kg).replace(',', '.')) || 0, reps: parseFloat(String(s.reps).replace(',', '.')) || 0, done: true }))
        })).filter(ex => ex.sets.length)
      });
      store.data.activeWorkout = null;
      store.save();
      ctx.navigate('home');
    });
  }

  render();
  timerInterval = setInterval(updateTimerText, 1000);
  const unsub = store.subscribe(render);
  return () => { clearInterval(timerInterval); unsub(); };
}
