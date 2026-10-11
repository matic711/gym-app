// Small SVG line chart with dots, three y-axis labels and first/mid/last x labels.
// points: [{ v: number, label: string }] — one per session, evenly spaced.

let chartSeq = 0;

export function lineChartHtml(points, { color = 'var(--accent)', fmt = v => String(Math.round(v)), height = 150 } = {}) {
  if (!points.length) {
    return `<div style="height: ${height}px; display: flex; align-items: center; justify-content: center; color: var(--text2); font-size: 14px">Ni podatkov.</div>`;
  }
  const W = 318, H = height, PAD = 10;
  const vals = points.map(p => p.v);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;
  const n = points.length;
  const x = i => n > 1 ? PAD + (i / (n - 1)) * (W - PAD * 2) : W / 2;
  const y = v => PAD + (1 - (v - min) / range) * (H - PAD * 2);
  const pts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`);
  const line = 'M' + pts.join(' L');
  const area = `M${x(0).toFixed(1)},${H} L` + pts.join(' L') + ` L${x(n - 1).toFixed(1)},${H} Z`;
  const gid = 'lcgrad' + (++chartSeq);
  const dots = n <= 40 ? points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${i === n - 1 ? 4.5 : 3}" style="fill: ${i === n - 1 ? color : 'var(--card)'}; stroke: ${color}" stroke-width="2"></circle>`).join('') : '';
  const grid = [0.25, 0.5, 0.75].map(f => `M0 ${(PAD + f * (H - PAD * 2)).toFixed(1)}H${W}`).join('');
  const mid = points[Math.floor((n - 1) / 2)];

  return `
<div style="display: flex; gap: 8px">
<svg width="286" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Graf napredka" style="flex-grow: 1; overflow: visible">
<defs>
<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" style="stop-color: ${color}; stop-opacity: 0.18"></stop>
<stop offset="1" style="stop-color: ${color}; stop-opacity: 0"></stop>
</linearGradient>
</defs>
<path d="${grid}" style="stroke: var(--line)" stroke-width="1" fill="none"></path>
${n > 1 ? `<path d="${area}" fill="url(#${gid})"></path>` : ''}
${n > 1 ? `<path d="${line}" fill="none" style="stroke: ${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>` : ''}
${dots}
</svg>
<div style="display: flex; flex-direction: column; justify-content: space-between; padding: 4px 0; font-size: 11px; color: var(--text2); height: ${H}px; box-sizing: border-box; min-width: 34px; text-align: right">
<span>${fmt(max)}</span><span>${fmt((max + min) / 2)}</span><span>${fmt(min)}</span>
</div>
</div>
<div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text2); padding-right: 42px">
<span>${points[0].label}</span>${n > 2 ? `<span>${mid.label}</span>` : ''}${n > 1 ? `<span>${points[n - 1].label}</span>` : ''}
</div>`;
}
