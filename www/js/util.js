export const DOW = ['Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota', 'Nedelja'];
export const DOW_SHORT = ['P', 'T', 'S', 'Č', 'P', 'S', 'N'];
export const MONTHS = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'];
export const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];

export function dowMon(d) { return (d.getDay() + 6) % 7; }
export function isoDate(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; }
export function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
export function fromIso(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
export function startOfWeek(d) { return addDays(d, -dowMon(d)); }

export function fmtWeekday(d) { return DOW[dowMon(d)]; }
export function fmtDate(d) { return `${d.getDate()}. ${MONTHS[d.getMonth()]}`; }
export function fmtDateShort(d) { return `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`; }
export function fmtNum(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
export function fmtNum1(n) { return (Math.round(n * 10) / 10).toFixed(1).replace('.', ','); }

// Slovenian noun forms for 1 / 2 / 3–4 / 5+ (e.g. ['vaja', 'vaji', 'vaje', 'vaj']).
export function plural(n, forms) {
  const m = Math.abs(n) % 100;
  const f = m === 1 ? forms[0] : m === 2 ? forms[1] : m === 3 || m === 4 ? forms[2] : forms[3];
  return `${n} ${f}`;
}

export function workoutVolume(w) {
  let v = 0;
  for (const ex of w.exercises) for (const s of ex.sets) {
    if (s.done === false) continue;
    v += (Number(s.kg) || 0) * (Number(s.reps) || 0);
  }
  return v;
}
export function workoutSetCount(w) {
  let c = 0;
  for (const ex of w.exercises) c += ex.sets.length;
  return c;
}

export function rerenderPreservingFocus(root, renderFn) {
  const active = document.activeElement;
  const isInside = active && root.contains(active);
  const id = isInside ? active.id : null;
  const selStart = isInside && 'selectionStart' in active ? active.selectionStart : null;
  const selEnd = isInside && 'selectionEnd' in active ? active.selectionEnd : null;
  renderFn();
  if (id) {
    const el = root.querySelector('#' + CSS.escape(id));
    if (el) {
      el.focus();
      if (selStart != null && 'setSelectionRange' in el) {
        try { el.setSelectionRange(selStart, selEnd); } catch (e) { /* not a text-selectable input type */ }
      }
    }
  }
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
