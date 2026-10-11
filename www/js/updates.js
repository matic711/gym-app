// Checks GitHub Releases (published by .github/workflows/android.yml) for a newer APK.
/* global __APP_VERSION__ */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

const REPO = 'matic711/gym-app';
export const DOWNLOAD_URL = `https://github.com/${REPO}/releases/latest/download/gym-app.apk`;

function buildNumber(version) {
  const m = /(\d+)$/.exec(String(version));
  return m ? Number(m[1]) : 0;
}

// Resolves to { version, notes } when a newer build exists, otherwise null.
export async function checkForUpdate() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error('GitHub ' + res.status);
  const rel = await res.json();
  const latest = buildNumber(rel.tag_name);
  if (APP_VERSION !== 'dev' && latest <= buildNumber(APP_VERSION)) return null;
  return { version: (rel.name || rel.tag_name).replace(/^Gym aplikacija\s*/, ''), notes: rel.body || '' };
}

export function openDownload() {
  // Capacitor hands non-app URLs to the system browser, which downloads the APK.
  window.location.href = DOWNLOAD_URL;
}
