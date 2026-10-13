import { store } from '../state.js';
import { fromIso, fmtDateShort, fmtNum1 } from '../util.js';
import { formReport, pct, hm } from '../analysis.js';
import { lineChartHtml } from '../components/lineChart.js';
import { detectPlateaus } from '../plateau.js';
import { escapeHtml } from '../util.js';

const LEVEL_STYLE = {
  bad: { color: 'var(--danger)', icon: '<path d="M12 8v5M12 16.5h.01"></path><circle cx="12" cy="12" r="9"></circle>' },
  warn: { color: 'var(--mood)', icon: '<path d="M12 4 2.8 19.5h18.4z"></path><path d="M12 10v4M12 16.8h.01"></path>' },
  good: { color: 'var(--good)', icon: '<path d="M4 16l5-5 4 4 7-7"></path><path d="M15 8h5v5"></path>' },
  info: { color: 'var(--accentText)', icon: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 7.5h.01"></path>' }
};

function fmtThreshold(key, v) {
  if (key === 'sleep') return hm(v);
  if (key === 'quality') return `${fmtNum1(v)}/5`;
  if (key === 'weight') return `${fmtNum1(v)} kg`;
  return `${fmtNum1(v)}/10`;
}

function itemHtml(it) {
  const st = LEVEL_STYLE[it.level];
  return `<div style="display: flex; gap: 12px; padding: 12px 0; align-items: flex-start">
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: ${st.color}; flex-shrink: 0; margin-top: 1px">${st.icon}</svg>
<div style="display: flex; flex-direction: column; gap: 3px; min-width: 0">
<div style="font-size: 15px; font-weight: 600; color: ${st.color}">${it.title}</div>
<div style="font-size: 14px; color: var(--text)">${it.text}</div>
</div>
</div>`;
}

function factorHtml(f, i) {
  const border = i ? 'border-top: 1px solid var(--line);' : '';
  if (!f.enough) {
    return `<div style="padding: 12px 0; ${border}">
<div style="font-size: 15px; font-weight: 600">${f.label}</div>
<div style="font-size: 13px; color: var(--text2)">${f.reason === 'flat' ? 'Vrednost je skoraj vedno enaka, zato vpliva ni mogoče oceniti.' : `Še premalo podatkov (${f.n} od 8 treningov z vpisom tega dne).`}</div>
</div>`;
  }
  const better = f.diff >= 0;
  const size = Math.min(100, Math.round(Math.abs(f.diff) * 1000)); // 10 % = full bar
  const sentence = Math.abs(f.diff) < 0.01
    ? 'Ni opazne razlike v moči.'
    : `${f.more} (nad ${fmtThreshold(f.key, f.threshold)}) si v povprečju ${pct(Math.abs(f.diff)).slice(1)} ${better ? 'močnejši' : 'šibkejši'}.`;
  return `<div style="padding: 12px 0; display: flex; flex-direction: column; gap: 6px; ${border}">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px">
<span style="font-size: 15px; font-weight: 600">${f.label}</span>
<span style="font-size: 12px; color: var(--text2); flex-shrink: 0">povezava: ${f.strength}</span>
</div>
<div style="font-size: 14px">${sentence}</div>
<div style="height: 6px; border-radius: 3px; background: var(--fill); overflow: hidden">
<div style="width: ${size}%; height: 6px; border-radius: 3px; background: ${better ? 'var(--good)' : 'var(--danger)'}"></div>
</div>
<div style="font-size: 12px; color: var(--text2)">${f.n} treningov</div>
</div>`;
}

function statTile(label, value, color) {
  return `<div style="background: var(--fill); border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px">
<span style="font-size: 12px; color: var(--text2)">${label}</span>
<span style="font-size: 16px; font-weight: 700; ${color ? `color: ${color};` : ''}">${value}</span>
</div>`;
}

function changeTile(label, v, goodWhenUp = true) {
  if (v == null) return statTile(label, '—');
  const good = goodWhenUp ? v >= 0 : v <= 0;
  return statTile(label, pct(v), Math.abs(v) < 0.005 ? '' : good ? 'var(--good)' : 'var(--danger)');
}

function template(rep) {
  const t = rep.trend;
  const recent = rep.perfs.slice(-30);
  const points = recent.map(p => ({ v: p.perf * 100, label: fmtDateShort(fromIso(p.dateISO)) }));
  const goal = store.data.settings.goalPerWeek;

  return `
<header style="padding: 16px 12px 0 8px">
<a href="#/analitika" style="height: 44px; padding: 0 8px; display: inline-flex; align-items: center; gap: 2px; color: var(--accentText); text-decoration: none; font-size: 16px; font-weight: 500">
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>
Analitika
</a>
</header>

<main style="padding: 4px 20px 24px; display: flex; flex-direction: column; gap: 16px">
<div style="display: flex; flex-direction: column; gap: 4px">
<h1 style="margin: 0; font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">Forma</h1>
<div style="font-size: 14px; color: var(--text2)">Zadnji 4 tedni v primerjavi s prejšnjimi 4</div>
</div>

<section style="background: var(--card); border-radius: 22px; padding: 6px 18px; box-shadow: var(--shadow)">
${rep.items.map(itemHtml).join('<div style="border-top: 1px solid var(--line)"></div>')}
</section>

<section style="background: var(--card); border-radius: 22px; padding: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; box-shadow: var(--shadow)">
${changeTile('Moč', t.absChange)}
${changeTile('Moč glede na težo', t.relChange)}
${t.weightChange == null ? statTile('Teža', '—') : statTile('Teža', pct(t.weightChange))}
${changeTile('Volumen', t.volumeChange)}
${statTile('Treningov na teden', `${fmtNum1(t.perWeek)} <span style="font-size: 12px; font-weight: 500; color: var(--text2)">/ ${goal}</span>`, t.perWeek < goal - 0.5 ? 'var(--danger)' : '')}
${statTile('Redni vpisi', t.logRate == null ? '—' : `${Math.round(t.logRate * 100)} %`, t.logRate != null && t.logRate < 0.8 ? 'var(--danger)' : '')}
</section>

<section style="background: var(--card); border-radius: 22px; padding: 18px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow)">
<div style="display: flex; flex-direction: column; gap: 4px">
<h2 style="margin: 0; font-size: 15px; font-weight: 600; color: var(--accentText)">Forma po treningih</h2>
<div style="font-size: 13px; color: var(--text2)">Koliko si bil močnejši ali šibkejši kot običajno pri istih vajah</div>
</div>
${lineChartHtml(points, { fmt: v => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v))} %` })}
</section>

<section style="background: var(--card); border-radius: 22px; padding: 14px 18px 6px; display: flex; flex-direction: column; box-shadow: var(--shadow)">
<h2 style="margin: 0 0 2px; font-size: 15px; font-weight: 600">Kaj vpliva na tvoje lifte</h2>
<div style="font-size: 13px; color: var(--text2); padding-bottom: 4px">Iz jutranjih vpisov na dneve treningov</div>
${rep.factors.map(factorHtml).join('')}
</section>

${(() => {
  const list = detectPlateaus(store.data);
  return `<section style="background: var(--card); border-radius: 22px; padding: 14px 18px 6px; display: flex; flex-direction: column; box-shadow: var(--shadow)">
<h2 style="margin: 0 0 2px; font-size: 15px; font-weight: 600">Platoji</h2>
<div style="font-size: 13px; color: var(--text2); padding-bottom: 4px">Vaje brez napredka vsaj ${store.data.settings.plateauWeeks || 4} tedne</div>
${list.length ? list.map((x, i) => `<a href="#/vaja?name=${encodeURIComponent(x.name)}" style="padding: 10px 0; display: flex; justify-content: space-between; gap: 8px; text-decoration: none; color: var(--text); ${i ? 'border-top: 1px solid var(--line);' : ''}">
<span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${escapeHtml(x.name)}</span><span style="font-size: 12px; color: var(--text2)">Najboljše ${x.best} · ${x.sessions} treningov brez napredka</span></span>
<span style="font-size: 13px; font-weight: 700; flex-shrink: 0; color: ${x.cut ? 'var(--accentText)' : x.long ? 'var(--danger)' : 'var(--mood)'}">${x.weeks} t.${x.cut ? ' · cut' : ''}</span>
</a>`).join('') : '<div style="font-size: 14px; color: var(--good); padding: 6px 0 10px">Nobena vaja ne stoji. 👍</div>'}
</section>`;
})()}

<details style="background: var(--card); border-radius: 22px; padding: 14px 18px; box-shadow: var(--shadow); font-size: 14px; color: var(--text2)">
<summary style="font-size: 15px; font-weight: 600; color: var(--text); cursor: pointer">Kako se računa</summary>
<p style="margin: 10px 0 0">Vsako vajo na treningu primerjam s srednjo vrednostjo tvojih zadnjih (do 6) treningov iste vaje. Serije z različnim številom ponovitev so preračunane na primerljivo moč — prikazan je samo odstotek, ne ocena 1RM.</p>
<p style="margin: 8px 0 0">„Moč glede na težo“ deli moč s telesno težo tistega dne. Če med cutom moč pade sorazmerno s težo, to ni lenarjenje; opozorilo dobiš, ko pade tudi moč glede na težo.</p>
<p style="margin: 8px 0 0">Vplive računam tako, da treninge razdelim na polovico z višjo in polovico z nižjo vrednostjo (npr. spanec) in primerjam njuno povprečno formo. Potrebnih je vsaj 8 treningov z vpisom tistega dne.</p>
</details>
</main>`;
}

export function mount(root) {
  function render() { root.innerHTML = template(formReport(store.data)); }
  render();
  return store.subscribe(render);
}
