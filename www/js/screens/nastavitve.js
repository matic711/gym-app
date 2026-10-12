import { store, migrate } from '../state.js';
import { APP_VERSION, checkForUpdate, openDownload } from '../updates.js';
import { isDark } from '../theme.js';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';


function segButtons(options, current, onKey) {
  return options.map(label => {
    const on = label === current;
    return `<button type="button" role="radio" aria-checked="${on}" data-seg="${onKey}" data-v="${label}" style="height: 30px; padding: 0 11px; border: 0; border-radius: 7px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; ${on ? 'background: var(--card); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.12);' : 'background: transparent; color: var(--text2);'}">${label}</button>`;
  }).join('');
}

function switchRow(label, sub, on, action, first) {
  const track = `width: 51px; height: 31px; flex-shrink: 0; border: 0; border-radius: 16px; padding: 2px; cursor: pointer; display: flex; transition: background 0.2s; background: ${on ? 'var(--accent)' : 'var(--fill)'}; justify-content: ${on ? 'flex-end' : 'flex-start'};`;
  const knob = 'width: 27px; height: 27px; border-radius: 14px; background: #FFFFFF; box-shadow: 0 1px 3px rgba(0,0,0,0.25);';
  return `
<div style="min-height: 60px; padding: 8px 16px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 12px; ${first ? '' : 'border-top: 1px solid var(--line);'}">
<div style="display: flex; flex-direction: column; gap: 2px">
<span style="font-size: 16px">${label}</span>
${sub ? `<span style="font-size: 12px; color: var(--text2)">${sub}</span>` : ''}
</div>
<button type="button" aria-label="${label}" aria-pressed="${on}" data-toggle="${action}" style="${track}"><span style="${knob}"></span></button>
</div>`;
}

function restLabel(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return s ? `${m}:${String(s).padStart(2, '0')} min` : `${m} min`;
}

function template() {
  const s = store.data.settings;
  const dark = isDark(s);
  const pick = s.themePick || (dark ? 'Temna' : 'Svetla');
  const w = s.weightUnit === 'kg';
  const heightDisplay = s.heightUnit === 'cm' ? `${s.heightCm} cm` : `${Math.floor(s.heightCm / 30.48)} ft ${Math.round((s.heightCm / 2.54) % 12)} in`;
  const goalWeightDisplay = w ? `${s.goalWeightKg.toFixed(1).replace('.', ',')} kg` : `${(s.goalWeightKg * 2.2046).toFixed(1).replace('.', ',')} lb`;

  const swatches = [['#1F63E8', 'Modra'], ['#4F46E5', 'Indigo'], ['#0E7C86', 'Turkizna'], ['#C4561A', 'Oranžna']].map(([hex, label]) => {
    const on = hex.toLowerCase() === s.accent.toLowerCase();
    return `<button type="button" role="radio" aria-checked="${on}" aria-label="${label}" data-accent="${hex}" style="width: 28px; height: 28px; border-radius: 14px; border: 0; cursor: pointer; background: ${hex};${on ? ' box-shadow: 0 0 0 2px var(--card), 0 0 0 4px ' + hex + ';' : ''}"></button>`;
  }).join('');

  const t = s.toggles;

  return `
<main style="padding: 28px 20px 0; display: flex; flex-direction: column; gap: 8px; font-size: 16px">
<h1 style="margin: 0 0 12px; font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">Nastavitve</h1>

<a href="#" data-action="editProfile" style="background: var(--card); border-radius: 20px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; text-decoration: none; color: var(--text); box-shadow: var(--shadow)">
<div style="width: 52px; height: 52px; border-radius: 26px; background: var(--accent); color: var(--onAccent); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700">${(s.userName || 'M').slice(0, 1).toUpperCase()}</div>
<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1">
<div style="font-size: 17px; font-weight: 600">${s.userName || 'Uporabnik'}</div>
<div style="font-size: 13px; color: var(--text2)">Profil, višina, cilji</div>
</div>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: var(--text2)"><path d="M9 6l6 6-6 6"></path></svg>
</a>

<h2 style="margin: 18px 16px 0; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text2)">Cilji</h2>
<section style="background: var(--card); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow)">
<button type="button" data-action="editHeight" style="width: 100%; min-height: 52px; border: 0; background: transparent; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; font: inherit; color: var(--text); cursor: pointer">
<span style="font-size: 16px">Višina</span>
<span style="display: flex; align-items: center; gap: 6px; font-size: 15px; color: var(--text2)">${heightDisplay}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg></span>
</button>
<button type="button" data-action="editGoalWeight" style="width: 100%; min-height: 52px; border: 0; border-top: 1px solid var(--line); background: transparent; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; font: inherit; color: var(--text); cursor: pointer">
<span style="font-size: 16px">Ciljna teža</span>
<span style="display: flex; align-items: center; gap: 6px; font-size: 15px; color: var(--text2)">${goalWeightDisplay}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg></span>
</button>
<div style="min-height: 52px; border-top: 1px solid var(--line); padding: 0 16px; display: flex; align-items: center; justify-content: space-between">
<span style="font-size: 16px">Treningov na teden</span>
<div style="display: flex; align-items: center; gap: 4px">
<button type="button" aria-label="Manj" data-action="goalDown" style="width: 36px; height: 32px; border: 0; border-radius: 8px; background: var(--fill); color: var(--text); font: inherit; font-size: 18px; cursor: pointer">−</button>
<span style="width: 28px; text-align: center; font-size: 16px; font-weight: 600">${s.goalPerWeek}</span>
<button type="button" aria-label="Več" data-action="goalUp" style="width: 36px; height: 32px; border: 0; border-radius: 8px; background: var(--fill); color: var(--text); font: inherit; font-size: 18px; cursor: pointer">+</button>
</div>
</div>
</section>

<h2 style="margin: 18px 16px 0; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text2)">Videz</h2>
<section style="background: var(--card); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow)">
<div style="min-height: 52px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between">
<span style="font-size: 16px">Tema</span>
<div role="radiogroup" aria-label="Tema" style="display: flex; gap: 2px; padding: 2px; border-radius: 9px; background: var(--fill)">${segButtons(['Svetla', 'Temna', 'Sistem'], pick, 'themePick')}</div>
</div>
<div style="min-height: 52px; border-top: 1px solid var(--line); padding: 0 16px; display: flex; align-items: center; justify-content: space-between">
<span style="font-size: 16px">Barva poudarka</span>
<div role="radiogroup" aria-label="Barva poudarka" style="display: flex; gap: 6px">${swatches}</div>
</div>
<div style="min-height: 52px; border-top: 1px solid var(--line); padding: 0 16px; display: flex; align-items: center; justify-content: space-between">
<span style="font-size: 16px">Velikost besedila</span>
<div role="radiogroup" aria-label="Velikost besedila" style="display: flex; gap: 2px; padding: 2px; border-radius: 9px; background: var(--fill)">${segButtons(['S', 'M', 'L'], s.textSize, 'textSize')}</div>
</div>
</section>

<h2 style="margin: 18px 16px 0; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text2)">Enote</h2>
<section style="background: var(--card); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow)">
<div style="min-height: 52px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between">
<span style="font-size: 16px">Teža</span>
<div role="radiogroup" aria-label="Enota za težo" style="display: flex; gap: 2px; padding: 2px; border-radius: 9px; background: var(--fill)">${segButtons(['kg', 'lb'], s.weightUnit, 'weightUnit')}</div>
</div>
<div style="min-height: 52px; border-top: 1px solid var(--line); padding: 0 16px; display: flex; align-items: center; justify-content: space-between">
<span style="font-size: 16px">Višina</span>
<div role="radiogroup" aria-label="Enota za višino" style="display: flex; gap: 2px; padding: 2px; border-radius: 9px; background: var(--fill)">${segButtons(['cm', 'ft'], s.heightUnit, 'heightUnit')}</div>
</div>
<div style="min-height: 52px; border-top: 1px solid var(--line); padding: 0 16px; display: flex; align-items: center; justify-content: space-between">
<span style="font-size: 16px">Razdalja</span>
<div role="radiogroup" aria-label="Enota za razdaljo" style="display: flex; gap: 2px; padding: 2px; border-radius: 9px; background: var(--fill)">${segButtons(['km', 'mi'], s.distUnit, 'distUnit')}</div>
</div>
</section>

<h2 style="margin: 18px 16px 0; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text2)">Datum in čas</h2>
<section style="background: var(--card); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow)">
<div style="min-height: 52px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between">
<span style="font-size: 16px">Oblika ure</span>
<div role="radiogroup" aria-label="Oblika ure" style="display: flex; gap: 2px; padding: 2px; border-radius: 9px; background: var(--fill)">${segButtons(['24 h', '12 h'], s.clock, 'clock')}</div>
</div>
<div style="width: 100%; min-height: 52px; border-top: 1px solid var(--line); padding: 0 16px; display: flex; align-items: center; justify-content: space-between">
<span style="font-size: 16px">Prvi dan v tednu</span>
<span style="font-size: 15px; color: var(--text2)">${s.firstDayMonday ? 'Ponedeljek' : 'Nedelja'}</span>
</div>
<div style="width: 100%; min-height: 52px; border-top: 1px solid var(--line); padding: 0 16px; display: flex; align-items: center; justify-content: space-between">
<span style="font-size: 16px">Oblika datuma</span>
<span style="font-size: 15px; color: var(--text2)">${new Date().toLocaleDateString('sl-SI')}</span>
</div>
</section>

<h2 style="margin: 18px 16px 0; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text2)">Trening</h2>
<section style="background: var(--card); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow)">
<button type="button" data-action="editRest" style="width: 100%; min-height: 52px; border: 0; background: transparent; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; font: inherit; color: var(--text); cursor: pointer">
<span style="font-size: 16px">Privzeti počitek</span>
<span style="display: flex; align-items: center; gap: 6px; font-size: 15px; color: var(--text2)">${restLabel(s.defaultRestSec)}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg></span>
</button>
${switchRow('Zvok ob koncu počitka', '', t.sound, 'sound', false)}
${switchRow('Vibriranje', '', t.vibe, 'vibe', false)}
${switchRow('Pokaži prejšnje vrednosti', '', t.prevValues, 'prevValues', false)}
</section>

<h2 style="margin: 18px 16px 0; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text2)">Merjeni parametri</h2>
<section style="background: var(--card); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow)">
${switchRow('Teža', 'Dnevni vpis · ' + s.weightUnit, t.trackWeight, 'trackWeight', true)}
${switchRow('Spanec', 'Čas spanja in kakovost', t.trackSleep, 'trackSleep', false)}
${switchRow('Počutje', 'Lestvica 1–5', t.trackMood, 'trackMood', false)}
${switchRow('Energija', 'Lestvica 1–10', t.trackEnergy, 'trackEnergy', false)}
${switchRow('Stres', 'Lestvica 1–10', t.trackStress, 'trackStress', false)}
${switchRow('Obseg pasu', 'Tedenski vpis · ' + (s.heightUnit === 'cm' ? 'cm' : 'in'), t.trackWaist, 'trackWaist', false)}
</section>

<h2 style="margin: 18px 16px 0; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text2)">Opomniki</h2>
<section style="background: var(--card); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow)">
${switchRow('Vpis počutja', 'Vsak dan ob ' + (s.clock === '24 h' ? '21:00' : '9:00 PM'), t.remindMood, 'remindMood', true)}
${switchRow('Tehtanje', 'Vsak dan ob ' + (s.clock === '24 h' ? '07:30' : '7:30 AM'), t.remindWeigh, 'remindWeigh', false)}
${switchRow('Trening', 'Ob ' + (s.clock === '24 h' ? '18:00' : '6:00 PM') + ', ko zaostajaš za tedenskim ciljem', t.remindTraining, 'remindTraining', false)}
</section>

<h2 style="margin: 18px 16px 0; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text2)">Podatki in varnostna kopija</h2>
<section style="background: var(--card); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow)">
<div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; align-items: center; gap: 12px">
<div style="width: 40px; height: 40px; border-radius: 12px; background: var(--accentSoft); color: var(--accentText); display: flex; align-items: center; justify-content: center; flex-shrink: 0">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"></path></svg>
</div>
<div style="display: flex; flex-direction: column; gap: 2px">
<span style="font-size: 16px; font-weight: 600">Izvozi podatke</span>
<span style="font-size: 12px; color: var(--text2)">Treningi, meritve in počutje</span>
</div>
</div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">
<button type="button" data-action="exportCsv" style="height: 40px; border: 0; border-radius: 12px; background: var(--fill); color: var(--text); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer">CSV</button>
<button type="button" data-action="exportJson" style="height: 40px; border: 0; border-radius: 12px; background: var(--fill); color: var(--text); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer">JSON</button>
<button type="button" data-action="exportPdf" style="height: 40px; border: 0; border-radius: 12px; background: var(--fill); color: var(--text); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer">PDF</button>
</div>
</div>
<div style="padding: 14px 16px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; align-items: center; gap: 12px">
<div style="width: 40px; height: 40px; border-radius: 12px; background: var(--accentSoft); color: var(--accentText); display: flex; align-items: center; justify-content: center; flex-shrink: 0">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A3.8 3.8 0 0 1 17.5 18z"></path><path d="M12 11v5M9.8 13.2 12 11l2.2 2.2"></path></svg>
</div>
<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1">
<span style="font-size: 16px; font-weight: 600">Varnostna kopija</span>
<span style="font-size: 12px; color: var(--text2)">${s.lastBackupAt ? 'Zadnja: ' + new Date(s.lastBackupAt).toLocaleString('sl-SI') : 'Še ni bila ustvarjena'}</span>
</div>
</div>
<button type="button" data-action="backupNow" style="height: 44px; border: 0; border-radius: 12px; background: var(--accent); color: var(--onAccent); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Ustvari kopijo zdaj</button>
</div>
${switchRow('Samodejna kopija', 'Tedensko · v napravo ali oblak', t.autoBackup, 'autoBackup', true)}
<button type="button" data-action="restoreBackup" style="width: 100%; min-height: 52px; border: 0; border-top: 1px solid var(--line); background: transparent; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; font: inherit; color: var(--text); cursor: pointer">
<span style="font-size: 16px">Obnovi iz kopije</span>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: var(--text2)"><path d="M9 6l6 6-6 6"></path></svg>
</button>
<button type="button" data-action="restoreBackup" style="width: 100%; min-height: 52px; border: 0; border-top: 1px solid var(--line); background: transparent; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; font: inherit; color: var(--text); cursor: pointer">
<span style="font-size: 16px">Uvozi podatke</span>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: var(--text2)"><path d="M9 6l6 6-6 6"></path></svg>
</button>
</section>

<section style="margin-top: 16px; background: var(--card); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow)">
<button type="button" data-action="deleteAll" style="width: 100%; min-height: 52px; border: 0; background: transparent; padding: 0 16px; font: inherit; font-size: 16px; font-weight: 600; color: var(--danger); cursor: pointer">Izbriši vse podatke</button>
</section>

<section style="margin-top: 16px; background: var(--card); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow)">
<div style="padding: 14px 16px; display: flex; align-items: center; gap: 12px">
<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0">
<span style="font-size: 16px; font-weight: 600">Posodobitve</span>
<span id="update-status" style="font-size: 12px; color: var(--text2)">Različica ${APP_VERSION}</span>
</div>
<button type="button" data-action="checkUpdate" style="height: 40px; padding: 0 14px; border: 0; border-radius: 12px; background: var(--accentSoft); color: var(--accentText); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; flex-shrink: 0">Preveri</button>
</div>
</section>
<input type="file" id="import-file-input" accept="application/json" style="display:none">
</main>`;
}

function toCsv(data) {
  const rows = [['type', 'date', 'name', 'exercise', 'kg', 'reps']];
  for (const w of data.workouts) {
    for (const ex of w.exercises) {
      for (const s of ex.sets) rows.push(['workout', w.dateISO, w.name, ex.name, s.kg, s.reps]);
    }
  }
  const wellRows = [['type', 'date', 'weight', 'bed', 'wake', 'quality', 'mood', 'energy', 'stress', 'note']];
  for (const [iso, e] of Object.entries(data.wellness)) {
    wellRows.push(['wellness', iso, e.weight, e.bed, e.wake, e.quality, e.mood, e.energy, e.stress, (e.note || '').replace(/[\r\n,]/g, ' ')]);
  }
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return rows.map(r => r.map(esc).join(',')).join('\n') + '\n\n' + wellRows.map(r => r.map(esc).join(',')).join('\n');
}

function downloadViaBrowser(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// A plain <a download> click on a blob: URL is a no-op in the Android
// WebView (there is no DownloadManager wired up for it) — the file must be
// written to disk via the native Filesystem plugin, then handed to the
// user through the native share sheet (save to Files/Drive, send by mail…).
async function exportFile(filename, mime, content) {
  if (!Capacitor.isNativePlatform()) {
    downloadViaBrowser(filename, mime, content);
    return;
  }
  try {
    const result = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    });
    await Share.share({ title: filename, url: result.uri, dialogTitle: 'Deli ali shrani datoteko' });
  } catch (err) {
    alert('Izvoz ni uspel: ' + (err && err.message ? err.message : err));
  }
}

export function mount(root, ctx) {
  function render() {
    root.innerHTML = template();
    wire();
  }

  function setSetting(patch) {
    Object.assign(store.data.settings, patch);
    store.save();
  }

  function wire() {
    root.querySelectorAll('[data-seg]').forEach(btn => btn.addEventListener('click', () => {
      setSetting({ [btn.getAttribute('data-seg')]: btn.getAttribute('data-v') });
    }));
    root.querySelectorAll('[data-accent]').forEach(btn => btn.addEventListener('click', () => {
      setSetting({ accent: btn.getAttribute('data-accent') });
    }));
    root.querySelectorAll('[data-toggle]').forEach(btn => btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-toggle');
      const t = { ...store.data.settings.toggles };
      t[key] = !t[key];
      setSetting({ toggles: t });
    }));
    root.querySelector('[data-action="editProfile"]').addEventListener('click', (e) => {
      e.preventDefault();
      const name = prompt('Tvoje ime:', store.data.settings.userName || '');
      if (name && name.trim()) setSetting({ userName: name.trim() });
    });
    root.querySelector('[data-action="editHeight"]').addEventListener('click', () => {
      const cur = store.data.settings.heightCm;
      const val = prompt('Višina v cm:', String(cur));
      const num = parseFloat(val);
      if (val != null && !isNaN(num) && num > 0) setSetting({ heightCm: Math.round(num) });
    });
    root.querySelector('[data-action="editGoalWeight"]').addEventListener('click', () => {
      const cur = store.data.settings.goalWeightKg;
      const val = prompt('Ciljna teža v kg:', String(cur));
      const num = parseFloat(String(val).replace(',', '.'));
      if (val != null && !isNaN(num) && num > 0) setSetting({ goalWeightKg: num });
    });
    root.querySelector('[data-action="goalDown"]').addEventListener('click', () => {
      setSetting({ goalPerWeek: Math.max(1, store.data.settings.goalPerWeek - 1) });
    });
    root.querySelector('[data-action="goalUp"]').addEventListener('click', () => {
      setSetting({ goalPerWeek: Math.min(7, store.data.settings.goalPerWeek + 1) });
    });
    root.querySelector('[data-action="editRest"]').addEventListener('click', () => {
      const cur = store.data.settings.defaultRestSec;
      const val = prompt('Privzeti počitek (sekunde):', String(cur));
      const num = parseInt(val, 10);
      if (val != null && !isNaN(num) && num > 0) setSetting({ defaultRestSec: num });
    });
    root.querySelector('[data-action="exportCsv"]').addEventListener('click', () => exportFile('gym-aplikacija.csv', 'text/csv', toCsv(store.data)));
    root.querySelector('[data-action="exportJson"]').addEventListener('click', () => exportFile('gym-aplikacija.json', 'application/json', JSON.stringify(store.data, null, 2)));
    root.querySelector('[data-action="exportPdf"]').addEventListener('click', () => alert('Izvoz v PDF še ni na voljo v tej različici.'));
    root.querySelector('[data-action="backupNow"]').addEventListener('click', async () => {
      await exportFile('gym-aplikacija-kopija.json', 'application/json', JSON.stringify(store.data, null, 2));
      setSetting({ lastBackupAt: Date.now() });
    });
    const fileInput = root.querySelector('#import-file-input');
    root.querySelectorAll('[data-action="restoreBackup"]').forEach(btn => btn.addEventListener('click', () => fileInput.click()));
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!parsed || typeof parsed !== 'object' || !parsed.settings) throw new Error('invalid');
          store.data = migrate(parsed);
          store.save();
          alert('Podatki so bili uspešno uvoženi.');
        } catch (e) {
          alert('Datoteke ni bilo mogoče prebrati. Preveri, ali gre za izvoženo JSON datoteko iz te aplikacije.');
        }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });
    root.querySelector('[data-action="checkUpdate"]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const status = root.querySelector('#update-status');
      if (btn.dataset.ready) { openDownload(); return; }
      btn.disabled = true;
      status.textContent = 'Preverjam …';
      try {
        const upd = await checkForUpdate();
        if (upd) {
          status.textContent = `Na voljo je ${upd.version} (imaš ${APP_VERSION})`;
          btn.textContent = 'Prenesi';
          btn.dataset.ready = '1';
          btn.style.background = 'var(--accent)';
          btn.style.color = 'var(--onAccent)';
        } else {
          status.textContent = `Različica ${APP_VERSION} · imaš najnovejšo`;
        }
      } catch (err) {
        status.textContent = 'Preverjanje ni uspelo — si povezan s spletom?';
      }
      btn.disabled = false;
    });
    root.querySelector('[data-action="deleteAll"]').addEventListener('click', () => {
      if (confirm('Izbrišem vse podatke aplikacije (treningi, predloge, počutje, nastavitve)? Tega dejanja ni mogoče razveljaviti.')) {
        store.reset();
        ctx.navigate('home');
      }
    });
  }

  render();
  return store.subscribe(render);
}
