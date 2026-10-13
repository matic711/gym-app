import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export function palette(dark, accent) {
  const a = accent;
  const custom = a && a.toLowerCase() !== '#1f63e8';
  // OLED: true black background, near-black cards.
  if (dark) return { bg:'#000000', card:'#111214', fill:'#1C1D20', text:'#F5F5F7', text2:'#8E8E93', line:'#232528', bar:'rgba(0,0,0,0.92)', accent: custom ? a : '#3D8BFF', accentText: custom ? a : '#7FB0FF', accentSoft:'rgba(61,139,255,0.16)', onAccent:'#FFFFFF', sleep:'#9F94FF', mood:'#FF9F5A', good:'#3DD68C', danger:'#FF6B6B', shadow:'none' };
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
