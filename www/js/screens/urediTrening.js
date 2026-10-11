import { store } from '../state.js';
import { escapeHtml } from '../util.js';
import { openExercisePicker } from '../components/exercisePicker.js';

function toNum(v) {
  return parseFloat(String(v).replace(',', '.'));
}

function cloneWorkout(w) {
  return {
    ...w,
    exercises: w.exercises.map(ex => ({ ...ex, sets: ex.sets.map(s => ({ kg: String(s.kg).replace('.', ','), reps: String(s.reps) })) }))
  };
}

function template(d) {
  const inputStyle = 'height: 36px; box-sizing: border-box; border: 0; border-radius: 10px; background: var(--fill); text-align: center; font: inherit; font-size: 15px; font-weight: 600; color: var(--text); outline: none;';
  const exercisesHtml = d.exercises.map((ex, ei) => `
<section style="background: var(--card); border-radius: 22px; padding: 16px 12px 12px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 4px">
<a href="#/vaja?name=${encodeURIComponent(ex.name)}" style="display: flex; flex-direction: column; gap: 2px; text-decoration: none; min-width: 0">
<h2 style="margin: 0; font-size: 17px; font-weight: 600; color: var(--accentText)">${escapeHtml(ex.name)}</h2>
<div style="font-size: 12px; color: var(--text2)">${escapeHtml(ex.muscle || '')}</div>
</a>
<button type="button" data-action="removeExercise" data-ei="${ei}" aria-label="Odstrani vajo ${escapeHtml(ex.name)}" style="width: 40px; height: 40px; border: 0; border-radius: 20px; background: transparent; color: var(--danger); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"></path></svg>
</button>
</div>
<div style="display: grid; grid-template-columns: 40px minmax(0, 1fr) minmax(0, 1fr) 40px; gap: 8px; padding: 0 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text2)">
<div style="text-align: center">Ser.</div><div style="text-align: center">kg</div><div style="text-align: center">Pon.</div><div></div>
</div>
${ex.sets.map((s, si) => `
<div style="display: grid; grid-template-columns: 40px minmax(0, 1fr) minmax(0, 1fr) 40px; gap: 8px; align-items: center; padding: 0 4px">
<div style="text-align: center; font-size: 15px; font-weight: 700">${si + 1}</div>
<input type="text" inputmode="decimal" id="kg-${ei}-${si}" aria-label="${escapeHtml(ex.name)}, serija ${si + 1}, teža v kg" data-field="kg" data-ei="${ei}" data-si="${si}" value="${escapeHtml(s.kg)}" style="${inputStyle} width: 100%">
<input type="text" inputmode="numeric" id="reps-${ei}-${si}" aria-label="${escapeHtml(ex.name)}, serija ${si + 1}, ponovitve" data-field="reps" data-ei="${ei}" data-si="${si}" value="${escapeHtml(s.reps)}" style="${inputStyle} width: 100%">
<button type="button" data-action="removeSet" data-ei="${ei}" data-si="${si}" aria-label="Odstrani serijo ${si + 1}" style="width: 40px; height: 36px; border: 0; border-radius: 10px; background: transparent; color: var(--text2); display: flex; align-items: center; justify-content: center; cursor: pointer">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
</button>
</div>`).join('')}
<button type="button" data-action="addSet" data-ei="${ei}" style="height: 40px; border: 0; border-radius: 12px; background: var(--fill); color: var(--text); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; margin: 4px 4px 0">+ Dodaj serijo</button>
</section>`).join('');

  const fieldLabel = 'font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text2)';
  const fieldInput = 'height: 44px; box-sizing: border-box; border: 0; border-radius: 12px; background: var(--card); padding: 0 12px; font: inherit; font-size: 16px; font-weight: 600; color: var(--text); outline: none; box-shadow: var(--shadow); width: 100%';

  return `
<header style="padding: 16px 12px 0 8px; display: flex; align-items: center; justify-content: space-between">
<a href="#" data-action="cancel" style="height: 44px; padding: 0 8px; display: flex; align-items: center; gap: 2px; color: var(--accentText); text-decoration: none; font-size: 16px; font-weight: 500">
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>
Prekliči
</a>
<div style="font-size: 15px; font-weight: 600; color: var(--text2)">Urejanje treninga</div>
<div style="width: 80px"></div>
</header>

<main style="padding: 8px 20px 0; display: flex; flex-direction: column; gap: 16px">
<div style="display: flex; flex-direction: column; gap: 6px">
<label for="ime-treninga" style="${fieldLabel}">Ime treninga</label>
<input id="ime-treninga" type="text" value="${escapeHtml(d.name)}" style="border: 0; outline: none; background: transparent; padding: 0; font: inherit; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; color: var(--text); width: 100%">
</div>

<div style="display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 12px">
<div style="display: flex; flex-direction: column; gap: 6px">
<label for="datum-treninga" style="${fieldLabel}">Datum</label>
<input id="datum-treninga" type="date" value="${d.dateISO}" style="${fieldInput}">
</div>
<div style="display: flex; flex-direction: column; gap: 6px">
<label for="trajanje-treninga" style="${fieldLabel}">Trajanje (min)</label>
<input id="trajanje-treninga" type="text" inputmode="numeric" value="${d.durationMin}" style="${fieldInput}">
</div>
</div>

${exercisesHtml}

<button type="button" data-action="addExercise" style="height: 52px; border: 0; border-radius: 16px; background: var(--accentSoft); color: var(--accentText); font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
Dodaj vajo
</button>

<button type="button" data-action="delete" style="height: 48px; border: 0; border-radius: 16px; background: transparent; color: var(--danger); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Izbriši trening</button>
</main>

<footer style="position: fixed; bottom: 0; box-sizing: border-box; width: 100%; padding: 12px 20px calc(env(safe-area-inset-bottom, 0px) + 20px); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; background: var(--bar); border-top: 1px solid var(--line); max-width: 560px; left: 50%; transform: translateX(-50%)">
<button type="button" data-action="cancel" style="height: 52px; border: 0; border-radius: 16px; background: var(--fill); color: var(--text); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Prekliči</button>
<button type="button" data-action="save" style="height: 52px; border: 0; border-radius: 16px; background: var(--accent); color: var(--onAccent); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Shrani</button>
</footer>`;
}

export function mount(root, ctx) {
  const original = store.data.workouts.find(w => w.id === ctx.params.id);
  if (!original) { ctx.navigate('trening'); return; }
  const draft = cloneWorkout(original);
  let dirty = false;
  root.style.paddingBottom = 'calc(96px + env(safe-area-inset-bottom, 0px) + 20px)';

  function leave() {
    if (history.length > 1) history.back(); else ctx.navigate('trening');
  }

  function render() {
    root.innerHTML = template(draft);
    wire();
  }

  function structural(fn) {
    fn();
    dirty = true;
    render();
  }

  function save() {
    const durationMin = Math.round(toNum(draft.durationMin));
    const exercises = draft.exercises.map(ex => ({
      name: ex.name, muscle: ex.muscle || '',
      sets: ex.sets
        .filter(s => String(s.kg).trim() !== '' && String(s.reps).trim() !== '')
        .map(s => ({ kg: toNum(s.kg) || 0, reps: toNum(s.reps) || 0, done: true }))
    })).filter(ex => ex.sets.length);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dateISO)) { alert('Vnesi veljaven datum.'); return; }
    const dropped = draft.exercises.length - exercises.length;
    if (dropped > 0 && !confirm(`${dropped === 1 ? 'Ena vaja nima' : dropped + ' vaj nima'} izpolnjenih serij in bo odstranjena. Nadaljujem?`)) return;

    const target = store.data.workouts.find(w => w.id === original.id);
    if (!target) { leave(); return; }
    target.name = draft.name.trim() || 'Trening';
    target.dateISO = draft.dateISO;
    target.durationMin = durationMin > 0 ? durationMin : target.durationMin;
    target.exercises = exercises;
    target.editedAt = Date.now();
    dirty = false;
    store.save();
    leave();
  }

  function wire() {
    root.querySelector('#ime-treninga').addEventListener('input', (e) => { draft.name = e.target.value; dirty = true; });
    root.querySelector('#datum-treninga').addEventListener('change', (e) => { draft.dateISO = e.target.value; dirty = true; });
    root.querySelector('#trajanje-treninga').addEventListener('input', (e) => { draft.durationMin = e.target.value; dirty = true; });
    root.querySelectorAll('input[data-field]').forEach(inp => inp.addEventListener('input', (e) => {
      const ei = Number(inp.dataset.ei), si = Number(inp.dataset.si);
      draft.exercises[ei].sets[si][inp.dataset.field] = e.target.value;
      dirty = true;
    }));
    root.querySelectorAll('[data-action="removeSet"]').forEach(btn => btn.addEventListener('click', () => {
      structural(() => draft.exercises[Number(btn.dataset.ei)].sets.splice(Number(btn.dataset.si), 1));
    }));
    root.querySelectorAll('[data-action="addSet"]').forEach(btn => btn.addEventListener('click', () => {
      structural(() => {
        const sets = draft.exercises[Number(btn.dataset.ei)].sets;
        const last = sets[sets.length - 1];
        sets.push({ kg: last ? last.kg : '', reps: last ? last.reps : '' });
      });
    }));
    root.querySelectorAll('[data-action="removeExercise"]').forEach(btn => btn.addEventListener('click', () => {
      const ex = draft.exercises[Number(btn.dataset.ei)];
      if (!confirm(`Odstranim vajo "${ex.name}" iz tega treninga?`)) return;
      structural(() => draft.exercises.splice(Number(btn.dataset.ei), 1));
    }));
    root.querySelector('[data-action="addExercise"]').addEventListener('click', () => {
      openExercisePicker({
        onPick: ({ name, muscle }) => structural(() => draft.exercises.push({ name, muscle, sets: [{ kg: '', reps: '' }] }))
      });
    });
    root.querySelectorAll('[data-action="cancel"]').forEach(el => el.addEventListener('click', (e) => {
      e.preventDefault();
      if (dirty && !confirm('Zavržem spremembe?')) return;
      leave();
    }));
    root.querySelector('[data-action="save"]').addEventListener('click', save);
    root.querySelector('[data-action="delete"]').addEventListener('click', () => {
      if (!confirm(`Izbrišem trening "${original.name}"? Tega dejanja ni mogoče razveljaviti.`)) return;
      store.data.workouts = store.data.workouts.filter(w => w.id !== original.id);
      store.save();
      ctx.navigate('trening');
    });
  }

  render();
}
