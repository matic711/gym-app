import { renderTabBar } from './components/tabbar.js';
import { store } from './state.js';
import { needsMorningCheckin } from './reminders.js';
import * as domov from './screens/domov.js';
import * as trening from './screens/trening.js';
import * as predloge from './screens/predloge.js';
import * as novTrening from './screens/novTrening.js';
import * as zdravje from './screens/zdravje.js';
import * as analitika from './screens/analitika.js';
import * as nastavitve from './screens/nastavitve.js';
import * as urediTrening from './screens/urediTrening.js';
import * as vaja from './screens/vaja.js';
import * as forma from './screens/forma.js';
import * as koledar from './screens/koledar.js';
import * as porocilo from './screens/porocilo.js';
import * as prehrana from './screens/prehrana.js';

const SCREENS = {
  home: { mod: domov, tab: 'home' },
  trening: { mod: trening, tab: 'trening' },
  predloge: { mod: predloge, tab: 'trening' },
  nov: { mod: novTrening, tab: null },
  zdravje: { mod: zdravje, tab: 'koledar' },
  koledar: { mod: koledar, tab: 'koledar' },
  porocilo: { mod: porocilo, tab: 'analitika' },
  prehrana: { mod: prehrana, tab: 'home' },
  analitika: { mod: analitika, tab: 'analitika' },
  nastavitve: { mod: nastavitve, tab: 'nastavitve' },
  uredi: { mod: urediTrening, tab: null },
  vaja: { mod: vaja, tab: 'analitika' },
  forma: { mod: forma, tab: 'analitika' }
};

let currentUnmount = null;

export function navigate(route, params) {
  const target = '#/' + route + (params ? '?' + new URLSearchParams(params).toString() : '');
  if (location.hash === target) { render(); return; }
  location.hash = target;
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [route, qs] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  return { route: route || 'home', params };
}

function render() {
  let { route, params } = parseHash();
  let entry = SCREENS[route] || SCREENS.home;
  // Morning check-in comes first; only a workout already in progress may skip it.
  if (needsMorningCheckin(store.data) && !(route === 'nov' && store.data.activeWorkout)) {
    params = { jutro: '1' };
    entry = { mod: zdravje, tab: null };
  }

  const screenRoot = document.getElementById('screen-root');
  const tabbarRoot = document.getElementById('tabbar-root');

  if (typeof currentUnmount === 'function') {
    try { currentUnmount(); } catch (e) { /* ignore */ }
  }
  currentUnmount = null;

  tabbarRoot.innerHTML = entry.tab ? renderTabBar(entry.tab) : '';
  screenRoot.classList.toggle('has-tabbar', !!entry.tab);
  screenRoot.innerHTML = '';
  screenRoot.style.paddingBottom = '';
  screenRoot.scrollTop = 0;
  window.scrollTo(0, 0);

  const ctx = { navigate, params, refresh: render };
  const result = entry.mod.mount(screenRoot, ctx);
  if (typeof result === 'function') currentUnmount = result;

  // wire tabbar links to use the SPA router (avoids full reload flicker)
  tabbarRoot.querySelectorAll('a[data-route]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(a.getAttribute('data-route'));
    });
  });
}

// Re-check the morning lock, e.g. when the app comes back after midnight.
export function refresh() { render(); }

export function startRouter() {
  window.addEventListener('hashchange', render);
  if (!location.hash) location.hash = '#/home';
  render();
}
