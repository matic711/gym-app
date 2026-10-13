import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export function palette(dark, accent) {
  const a = accent;
  const custom = a && a.toLowerCase() !== '#1f63e8';
  if (dark) return { bg:'#1B1D21', card:'#25282E', fill:'#30343B', text:'#F1F3F6', text2:'#A6ADB9', line:'#383D45', bar:'rgba(29,31,36,0.94)', accent: custom ? a : '#5E98FF', accentText: custom ? a : '#8AB4FF', accentSoft:'rgba(94,152,255,0.16)', onAccent:'#0D1A33', sleep:'#A59CFF', mood:'#F2A061', good:'#4CC9A0', danger:'#FF8080', shadow:'0 0 0 1px rgba(255,255,255,0.03)' };
  return { bg:'#F2F4F7', card:'#FFFFFF', fill:'#EEF1F5', text:'#0C1321', text2:'#596375', line:'#E3E7ED', bar:'rgba(255,255,255,0.94)', accent: custom ? a : '#1F63E8', accentText: custom ? a : '#1A56CC', accentSoft:'#E7EFFD', onAccent:'#FFFFFF', sleep:'#5A4FD6', mood:'#C4561A', good:'#11805B', danger:'#C62828', shadow:'0 1px 3px rgba(16,24,40,0.06)' };
}

const TEXT_SCALE = { S: 0.9375, M: 1, L: 1.125 };

export function isDark(settings) {
  if (settings.themePick === 'Temna') return true;
  if (settings.themePick === 'Svetla') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(settings) {
  const dark = isDark(settings);
  const p = palette(dark, settings.accent);
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(p)) root.setProperty('--' + k, v);
  root.setProperty('--text-scale', String(TEXT_SCALE[settings.textSize] || 1));
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', p.bg);
  // Phone status bar (clock, battery) follows the app theme.
  if (Capacitor.isNativePlatform()) {
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
    StatusBar.setBackgroundColor({ color: p.bg }).catch(() => {});
  }
  return { dark, p };
}
