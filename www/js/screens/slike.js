import { store, isoDate } from '../state.js';
import { fromIso, fmtDate, fmtNum1, plural } from '../util.js';
import { POSES, poseLabel, sortedPhotos, hydratePhotos } from '../photos.js';
import { openPhotoAdd, openPhotoViewer } from '../components/photoSheets.js';

function template(pose) {
  const data = store.data;
  const list = sortedPhotos(data, pose);
  const byDay = new Map();
  for (const p of [...list].reverse()) {
    if (!byDay.has(p.dateISO)) byDay.set(p.dateISO, []);
    byDay.get(p.dateISO).push(p);
  }
  const chip = (key, label) => {
    const on = (pose || '') === key;
    return `<button type="button" data-filter="${key}" aria-pressed="${on}" style="height: 34px; padding: 0 12px; border: 0; border-radius: 17px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; flex-shrink: 0; ${on ? 'background: var(--accent); color: var(--onAccent);' : 'background: var(--card); color: var(--text); box-shadow: var(--shadow);'}">${label}</button>`;
  };
  // "First vs latest" for the selected pose, or the pose with the most photos.
  const cmpPose = pose || POSES.map(p => p.key).sort((a, b) => sortedPhotos(data, b).length - sortedPhotos(data, a).length)[0];
  const cmpList = sortedPhotos(data, cmpPose);
  const days = cmpList.length > 1 ? Math.round((fromIso(cmpList[cmpList.length - 1].dateISO) - fromIso(cmpList[0].dateISO)) / 86400000) : 0;
  const w = iso => { const e = data.wellness[iso]; return e && e.weight != null ? `${fmtNum1(e.weight)} kg` : ''; };

  return `
<header style="padding: 16px 12px 0 8px">
<a href="#" data-action="back" style="height: 44px; padding: 0 8px; display: inline-flex; align-items: center; gap: 2px; color: var(--accentText); text-decoration: none; font-size: 16px; font-weight: 500">
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>
Nazaj
</a>
</header>
<main style="padding: 4px 20px 24px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 10px">
<div style="display: flex; flex-direction: column; gap: 4px">
<h1 style="margin: 0; font-size: 30px; line-height: 1.15; font-weight: 700; letter-spacing: -0.02em">Slike napredka</h1>
<div style="font-size: 14px; color: var(--text2)">${plural(sortedPhotos(data).length, ['slika', 'sliki', 'slike', 'slik'])} · samo v aplikaciji, del varnostne kopije</div>
</div>
<button type="button" data-action="add" style="height: 40px; padding: 0 14px; border: 0; border-radius: 20px; background: var(--accent); color: var(--onAccent); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; flex-shrink: 0">+ Danes</button>
</div>
<div style="display: flex; gap: 8px; overflow-x: auto; padding: 2px">${chip('', 'Vse')}${POSES.map(p => chip(p.key, p.label)).join('')}</div>
${cmpList.length > 1 ? `<button type="button" data-action="compare" style="text-align: left; border: 0; background: var(--card); border-radius: 18px; padding: 14px 16px; display: flex; flex-direction: column; gap: 3px; box-shadow: var(--shadow); font: inherit; color: var(--text); cursor: pointer">
<span style="font-size: 15px; font-weight: 700; color: var(--accentText)">Primerjaj prvo in zadnjo · ${poseLabel(cmpPose)}</span>
<span style="font-size: 13px; color: var(--text2)">${fmtDate(fromIso(cmpList[0].dateISO))}${w(cmpList[0].dateISO) ? ` (${w(cmpList[0].dateISO)})` : ''} → ${fmtDate(fromIso(cmpList[cmpList.length - 1].dateISO))}${w(cmpList[cmpList.length - 1].dateISO) ? ` (${w(cmpList[cmpList.length - 1].dateISO)})` : ''} · ${days} dni</span>
</button>` : ''}
${byDay.size ? [...byDay.entries()].map(([iso, ps]) => `<section style="background: var(--card); border-radius: 20px; padding: 12px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow)">
<div style="display: flex; justify-content: space-between; gap: 8px; padding: 0 4px"><a href="#/koledar?date=${iso}" style="font-size: 15px; font-weight: 700; color: var(--text); text-decoration: none">${fmtDate(fromIso(iso))}</a><span style="font-size: 13px; color: var(--text2)">${w(iso)}</span></div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">
${ps.map(p => `<button type="button" data-open="${p.id}" style="border: 0; padding: 0; background: var(--fill); border-radius: 12px; overflow: hidden; cursor: pointer; display: flex; flex-direction: column; font: inherit; color: var(--text)">
<img data-photo="${p.id}" data-thumb="1" alt="${poseLabel(p.pose)}" style="width: 100%; aspect-ratio: 3 / 4; object-fit: cover; display: block">
<span style="font-size: 12px; font-weight: 600; padding: 4px 0 6px">${poseLabel(p.pose)}</span>
</button>`).join('')}
</div>
</section>`).join('') : `<section style="background: var(--card); border-radius: 20px; padding: 16px; box-shadow: var(--shadow); font-size: 14px; color: var(--text2)">${pose ? 'Ni slik s to pozo.' : 'Še ni slik. Dodaš jih tukaj ali v koledarju pod izbranim dnem.'}</section>`}
</main>`;
}

export function mount(root, ctx) {
  let pose = POSES.some(p => p.key === ctx.params.poza) ? ctx.params.poza : '';
  function render() {
    root.innerHTML = template(pose);
    root.querySelector('[data-action="back"]').addEventListener('click', (e) => {
      e.preventDefault();
      if (history.length > 1) history.back(); else ctx.navigate('analitika');
    });
    root.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
      pose = b.dataset.filter;
      history.replaceState(null, '', pose ? `#/slike?poza=${pose}` : '#/slike');
      render();
    }));
    root.querySelector('[data-action="add"]').addEventListener('click', () => openPhotoAdd({ dateISO: isoDate(new Date()) }));
    root.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openPhotoViewer(b.dataset.open)));
    root.querySelector('[data-action="compare"]')?.addEventListener('click', () => {
      const cmpPose = pose || POSES.map(p => p.key).sort((a, b) => sortedPhotos(store.data, b).length - sortedPhotos(store.data, a).length)[0];
      const l = sortedPhotos(store.data, cmpPose);
      openPhotoViewer(l[l.length - 1].id, { compare: true });
    });
    hydratePhotos(root, store.data);
  }
  render();
  return store.subscribe(render);
}
