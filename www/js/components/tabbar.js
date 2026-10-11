const ICONS = {
  home: '<path d="M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5A1.5 1.5 0 0 1 3.5 19z"></path>',
  trening: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"></path>',
  zdravje: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"></path>',
  analitika: '<path d="M5 20v-7M12 20V5M19 20v-11"></path>',
  nastavitve: '<path d="M4 7h9M18 7h2M4 17h4M13 17h7"></path><circle cx="15.5" cy="7" r="2.3"></circle><circle cx="10.5" cy="17" r="2.3"></circle>'
};

const ITEMS = [
  { key: 'home', label: 'Domov', route: 'home' },
  { key: 'trening', label: 'Trening', route: 'trening' },
  { key: 'zdravje', label: 'Počutje', route: 'zdravje' },
  { key: 'analitika', label: 'Analitika', route: 'analitika' },
  { key: 'nastavitve', label: 'Nastavitve', route: 'nastavitve' }
];

export function renderTabBar(activeKey) {
  const items = ITEMS.map(it => {
    const color = it.key === activeKey ? 'var(--accentText)' : 'var(--text2)';
    return `<a href="#/${it.route}" data-route="${it.route}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-decoration: none; color: ${color}; font-size: 11px; font-weight: 600; min-height: 48px">
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[it.key]}</svg>
<span>${it.label}</span>
</a>`;
  }).join('\n');

  return `<nav aria-label="Glavna navigacija" class="tabbar" style="width: 100%; box-sizing: border-box; padding: 8px 12px calc(env(safe-area-inset-bottom, 0px) + 24px); display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; background: var(--bar); border-top: 1px solid var(--line); backdrop-filter: blur(20px); font-family: 'Geist', -apple-system, 'Segoe UI', sans-serif; color: var(--text2); position: fixed; bottom: 0; z-index: 50; max-width: 560px; left: 50%; transform: translateX(-50%);">
${items}
</nav>`;
}
