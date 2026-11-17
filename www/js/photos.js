// Progress photos. The images are files in the app's private storage
// (Directory.Data): they survive app updates and don't show up in the phone's
// gallery. The list (date, pose) is part of the app data. Backups include the
// images, so they move to a new phone with everything else.
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export const POSES = [
  { key: 'front', label: 'Spredaj' },
  { key: 'side', label: 'S strani' },
  { key: 'back', label: 'Zadaj' },
  { key: 'other', label: 'Drugo' }
];
export function poseLabel(key) { return (POSES.find(p => p.key === key) || POSES[3]).label; }

const DIR = 'slike';
const FULL = 1600;   // longest side of the stored photo, px
const THUMB = 360;   // thumbnails for the calendar and gallery
const fileOf = (id, thumb) => `${DIR}/${id}${thumb ? '_t' : ''}.jpg`;
const poseOrder = key => Math.max(0, POSES.findIndex(p => p.key === key));

export function photoList(data) {
  if (!Array.isArray(data.photos)) data.photos = [];
  return data.photos;
}

// Oldest first; same day by pose.
export function sortedPhotos(data, pose) {
  return photoList(data)
    .filter(p => !pose || p.pose === pose)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || poseOrder(a.pose) - poseOrder(b.pose) || a.at - b.at);
}

export function photosOn(data, iso) { return sortedPhotos(data).filter(p => p.dateISO === iso); }

function newId() { return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

async function loadImage(blob) {
  // createImageBitmap applies the EXIF rotation of camera photos.
  if (window.createImageBitmap) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) { /* fall back */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Slike ni mogoče prebrati.')); };
    img.src = url;
  });
}

function toJpeg(img, max, quality) {
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * k));
  c.height = Math.max(1, Math.round(img.height * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return { b64: c.toDataURL('image/jpeg', quality).split(',')[1], w: c.width, h: c.height };
}

function b64ToBlob(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

function blobToB64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

const write = (path, b64) => Filesystem.writeFile({ path, data: b64, directory: Directory.Data, recursive: true });

// Saves a picked or taken photo (downscaled JPEG + thumbnail) for a day.
export async function addPhoto(data, file, { dateISO, pose }) {
  const img = await loadImage(file);
  const full = toJpeg(img, FULL, 0.85);
  const thumb = toJpeg(img, THUMB, 0.75);
  if (img.close) img.close();
  const id = newId();
  await write(fileOf(id), full.b64);
  await write(fileOf(id, true), thumb.b64);
  const p = { id, dateISO, pose, w: full.w, h: full.h, at: Date.now() };
  photoList(data).push(p);
  return p;
}

export async function deletePhoto(data, id) {
  for (const thumb of [false, true]) {
    try { await Filesystem.deleteFile({ path: fileOf(id, thumb), directory: Directory.Data }); } catch (e) { /* already gone */ }
  }
  urlCache.delete(id); urlCache.delete(id + 't');
  data.photos = photoList(data).filter(p => p.id !== id);
}

export function setPose(data, id, pose) {
  const p = photoList(data).find(x => x.id === id);
  if (p) p.pose = pose;
}

const urlCache = new Map();

async function fileUrl(path) {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });
    return Capacitor.convertFileSrc(uri);
  }
  const r = await Filesystem.readFile({ path, directory: Directory.Data });
  return typeof r.data === 'string' ? 'data:image/jpeg;base64,' + r.data : URL.createObjectURL(r.data);
}

export async function photoUrl(p, thumb) {
  const key = p.id + (thumb ? 't' : '');
  if (urlCache.has(key)) return urlCache.get(key);
  let url;
  try { url = await fileUrl(fileOf(p.id, thumb)); } catch (e) {
    if (!thumb) throw e;
    url = await fileUrl(fileOf(p.id)); // no thumbnail (e.g. restored backup): use the photo
  }
  urlCache.set(key, url);
  return url;
}

// Fills every <img data-photo="id"> (data-thumb="1" for the small version) under root.
export function hydratePhotos(root, data) {
  root.querySelectorAll('img[data-photo]').forEach(async img => {
    const p = photoList(data).find(x => x.id === img.dataset.photo);
    if (!p) return;
    try { img.src = await photoUrl(p, img.dataset.thumb === '1'); } catch (e) { img.alt = 'Slike ni mogoče naložiti'; }
  });
}

// ---- backup ---------------------------------------------------------------

export async function readPhotoB64(p) {
  const r = await Filesystem.readFile({ path: fileOf(p.id), directory: Directory.Data });
  return typeof r.data === 'string' ? r.data : blobToB64(r.data);
}

// Writes the images from a backup ({ id: base64 }) and makes their thumbnails.
export async function restorePhotoFiles(files, onProgress) {
  const ids = Object.keys(files || {});
  let i = 0;
  for (const id of ids) {
    const b64 = files[id];
    if (typeof b64 !== 'string' || !b64) continue;
    await write(fileOf(id), b64);
    try {
      const img = await loadImage(b64ToBlob(b64));
      await write(fileOf(id, true), toJpeg(img, THUMB, 0.75).b64);
      if (img.close) img.close();
    } catch (e) { /* the photo itself is there; thumbnail falls back to it */ }
    if (onProgress) onProgress(++i, ids.length);
  }
  urlCache.clear();
  return i;
}

export async function removeAllPhotoFiles() {
  try { await Filesystem.rmdir({ path: DIR, directory: Directory.Data, recursive: true }); } catch (e) { /* nothing there */ }
  urlCache.clear();
}
