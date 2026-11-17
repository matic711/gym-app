import { store } from '../state.js';
import { fromIso, fmtDate, fmtNum1 } from '../util.js';
import { POSES, poseLabel, addPhoto, deletePhoto, setPose, sortedPhotos, photoList, photoUrl } from '../photos.js';

function sheet(title, bodyHtml) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; display: flex; align-items: flex-end;';
  overlay.innerHTML = `
<div style="background: var(--bg); width: 100%; max-width: 560px; margin: 0 auto; max-height: 88vh; border-radius: 20px 20px 0 0; box-shadow: 0 -4px 24px rgba(0,0,0,0.25); display: flex; flex-direction: column; overflow: hidden">
<div style="padding: 16px 20px 8px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0">
<h2 style="margin: 0; font-size: 19px; font-weight: 700; min-width: 0">${title}</h2>
<button type="button" data-sheet-close aria-label="Zapri" style="width: 40px; height: 40px; border: 0; border-radius: 20px; background: var(--fill); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
</button>
</div>
<div data-sheet-body style="overflow-y: auto; padding: 4px 20px calc(env(safe-area-inset-bottom, 0px) + 20px); display: flex; flex-direction: column; gap: 12px">${bodyHtml}</div>
</div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('[data-sheet-close]').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  return { el: overlay, body: overlay.querySelector('[data-sheet-body]'), close };
}

const chip = (key, label, on) => `<button type="button" data-pose="${key}" aria-pressed="${on}" style="height: 38px; padding: 0 14px; border: 0; border-radius: 19px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; ${on ? 'background: var(--accent); color: var(--onAccent);' : 'background: var(--fill); color: var(--text);'}">${label}</button>`;

// Add photos for a day: choose the pose, then take a photo or pick from the gallery.
export function openPhotoAdd({ dateISO }) {
  // Suggest the first pose not taken yet that day.
  const taken = new Set(photoList(store.data).filter(p => p.dateISO === dateISO).map(p => p.pose));
  let pose = (POSES.find(p => p.key !== 'other' && !taken.has(p.key)) || POSES[0]).key;
  const btn = (action, label, primary) => `<button type="button" data-action="${action}" style="height: 52px; border: 0; border-radius: 14px; font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; ${primary ? 'background: var(--accent); color: var(--onAccent);' : 'background: var(--fill); color: var(--text);'}">${label}</button>`;
  const s = sheet(`Slika napredka · ${fmtDate(fromIso(dateISO))}`, `
<div style="font-size: 13px; color: var(--text2)">Poza</div>
<div data-poses style="display: flex; gap: 8px; flex-wrap: wrap">${POSES.map(p => chip(p.key, p.label, p.key === pose)).join('')}</div>
<div style="font-size: 12px; color: var(--text2)">Za primerljive slike: ista svetloba, razdalja in poza, najbolje zjutraj.</div>
${btn('camera', 'Fotografiraj', true)}
${btn('gallery', 'Izberi iz galerije', false)}
<div data-status style="font-size: 13px; color: var(--text2); min-height: 18px"></div>
<input type="file" accept="image/*" capture="environment" data-input="camera" hidden>
<input type="file" accept="image/*" multiple data-input="gallery" hidden>`);
  const status = s.body.querySelector('[data-status]');
  function wirePoses() {
    s.body.querySelectorAll('[data-pose]').forEach(b => {
      b.onclick = () => {
        pose = b.dataset.pose;
        s.body.querySelector('[data-poses]').innerHTML = POSES.map(p => chip(p.key, p.label, p.key === pose)).join('');
        wirePoses();
      };
    });
  }
  wirePoses();
  for (const kind of ['camera', 'gallery']) {
    const input = s.body.querySelector(`[data-input="${kind}"]`);
    s.body.querySelector(`[data-action="${kind}"]`).addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const files = [...input.files];
      input.value = '';
      if (!files.length) return;
      s.body.querySelectorAll('button').forEach(b => { b.disabled = true; });
      let saved = 0;
      for (const f of files) {
        status.textContent = files.length > 1 ? `Shranjujem ${saved + 1} od ${files.length} …` : 'Shranjujem …';
        try { await addPhoto(store.data, f, { dateISO, pose }); saved++; } catch (e) { status.textContent = 'Slike ni bilo mogoče shraniti: ' + (e && e.message ? e.message : e); }
      }
      if (saved) store.save();
      if (saved === files.length) s.close();
      else s.body.querySelectorAll('button').forEach(b => { b.disabled = false; });
    });
  }
}

function weightOn(iso) {
  const e = store.data.wellness[iso];
  return e && e.weight != null ? `${fmtNum1(e.weight)} kg` : '';
}

function daysBetween(a, b) { return Math.round((fromIso(b) - fromIso(a)) / 86400000); }

// Full-screen viewer: previous/next photo of the same pose, compare with the
// first one of that pose, change pose, delete.
export function openPhotoViewer(id, { compare = false } = {}) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; inset: 0; background: #000; z-index: 210; display: flex; flex-direction: column; color: #fff;';
  document.body.appendChild(overlay);
  let curId = id, cmp = compare;
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  const btnStyle = 'height: 40px; padding: 0 14px; border: 0; border-radius: 20px; background: rgba(255,255,255,0.14); color: #fff; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;';

  function render() {
    const p = photoList(store.data).find(x => x.id === curId);
    if (!p) { close(); return; }
    const same = sortedPhotos(store.data, p.pose);
    const i = same.findIndex(x => x.id === p.id);
    const first = same[0];
    const canCompare = first && first.id !== p.id;
    const label = (x) => `<div style="font-size: 13px; font-weight: 600">${fmtDate(fromIso(x.dateISO))}${weightOn(x.dateISO) ? ` · ${weightOn(x.dateISO)}` : ''}</div>`;
    const img = (x) => `<img data-full="${x.id}" alt="${poseLabel(x.pose)}, ${fmtDate(fromIso(x.dateISO))}" style="width: 100%; height: 100%; object-fit: contain; display: block">`;
    overlay.innerHTML = `
<div style="padding: calc(env(safe-area-inset-top, 0px) + 10px) 12px 8px; display: flex; align-items: center; justify-content: space-between; gap: 10px">
<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0">
<div style="font-size: 16px; font-weight: 700">${poseLabel(p.pose)} · ${i + 1}/${same.length}</div>
<div style="font-size: 13px; opacity: 0.75">${fmtDate(fromIso(p.dateISO))}${weightOn(p.dateISO) ? ` · ${weightOn(p.dateISO)}` : ''}</div>
</div>
<button type="button" data-v="close" aria-label="Zapri" style="width: 44px; height: 44px; border: 0; border-radius: 22px; background: rgba(255,255,255,0.14); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
</button>
</div>
<div style="flex-grow: 1; min-height: 0; display: flex; gap: 4px; padding: 0 4px">
${cmp && canCompare ? `
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px"><div style="flex-grow: 1; min-height: 0">${img(first)}</div>${label(first)}</div>
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px"><div style="flex-grow: 1; min-height: 0">${img(p)}</div>${label(p)}</div>`
    : `<div style="flex: 1; min-width: 0">${img(p)}</div>`}
</div>
${cmp && canCompare ? `<div style="text-align: center; font-size: 13px; opacity: 0.8; padding-top: 6px">${daysBetween(first.dateISO, p.dateISO)} dni razlike</div>` : ''}
<div style="padding: 10px 12px calc(env(safe-area-inset-bottom, 0px) + 14px); display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; justify-content: space-between; gap: 8px">
<button type="button" data-v="prev" ${i <= 0 ? 'disabled' : ''} style="${btnStyle} ${i <= 0 ? 'opacity: 0.35;' : ''}">‹ Prejšnja</button>
${canCompare ? `<button type="button" data-v="compare" style="${btnStyle} ${cmp ? 'background: #fff; color: #000;' : ''}">${cmp ? 'Samo ta' : 'Primerjaj s prvo'}</button>` : ''}
<button type="button" data-v="next" ${i >= same.length - 1 ? 'disabled' : ''} style="${btnStyle} ${i >= same.length - 1 ? 'opacity: 0.35;' : ''}">Naslednja ›</button>
</div>
<div style="display: flex; justify-content: space-between; gap: 8px">
<button type="button" data-v="pose" style="${btnStyle}">Spremeni pozo</button>
<button type="button" data-v="delete" style="${btnStyle} color: #ff6b6b;">Izbriši</button>
</div>
</div>`;
    overlay.querySelectorAll('img[data-full]').forEach(async el => {
      const x = photoList(store.data).find(q => q.id === el.dataset.full);
      try { el.src = await photoUrl(x, false); } catch (e) { el.alt = 'Slike ni mogoče naložiti'; }
    });
    overlay.querySelector('[data-v="close"]').onclick = close;
    overlay.querySelector('[data-v="prev"]').onclick = () => { if (i > 0) { curId = same[i - 1].id; render(); } };
    overlay.querySelector('[data-v="next"]').onclick = () => { if (i < same.length - 1) { curId = same[i + 1].id; render(); } };
    const c = overlay.querySelector('[data-v="compare"]');
    if (c) c.onclick = () => { cmp = !cmp; render(); };
    overlay.querySelector('[data-v="pose"]').onclick = () => {
      const keys = POSES.map(x => x.key);
      const next = keys[(keys.indexOf(p.pose) + 1) % keys.length];
      setPose(store.data, p.id, next);
      store.save();
      render();
    };
    overlay.querySelector('[data-v="delete"]').onclick = async () => {
      if (!confirm('Izbrišem to sliko? Tega ni mogoče razveljaviti.')) return;
      const after = same[i + 1] || same[i - 1];
      await deletePhoto(store.data, p.id);
      store.save();
      if (after) { curId = after.id; render(); } else close();
    };
  }
  render();
}
