import { renderTabBar } from './components/tabbar.js';
import * as domov from './screens/domov.js';
import * as trening from './screens/trening.js';
import * as predloge from './screens/predloge.js';
import * as novTrening from './screens/novTrening.js';
import * as zdravje from './screens/zdravje.js';
import * as analitika from './screens/analitika.js';
import * as nastavitve from './screens/nastavitve.js';

const SCREENS = {
  home: { mod: domov, tab: 'home' },
  trening: { mod: trening, tab: 'trening' },
  predloge: { mod: predloge, tab: 'trening' },
  nov: { mod: novTrening, tab: null },
  zdravje: { mod: zdravje, tab: 'zdravje' },
  analitika: { mod: analitika, tab: 'analitika' },
  nastavitve: { mod: nastavitve, tab: 'nastavitve' }
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
  const { route, params } = parseHash();
  const entry = SCREENS[route] || SCREENS.home;

  const screenRoot = document.getElementById('screen-root');
  const tabbarRoot = document.getElementById('tabbar-root');

  if (typeof currentUnmount === 'function') {
    try { currentUnmount(); } catch (e) { /* ignore */ }
  }
  currentUnmount = null;

  tabbarRoot.innerHTML = entry.tab ? renderTabBar(entry.tab) : '';
  screenRoot.classList.toggle('has-tabbar', !!entry.tab);
  screenRoot.innerHTML = '';
  screenRoot.scrollTop = 0;
  window.scrollTo(0, 0);

  const ctx = { navigate, params };
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

export function startRouter() {
  window.addEventListener('hashchange', render);
  if (!location.hash) location.hash = '#/home';
  render();
}
