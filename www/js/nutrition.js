// Food logging: daily entries, own products and Open Food Facts lookups.
// Everything lives in store.data.nutrition; the feature is hidden unless
// settings.toggles.nutrition is on.
import { uid } from './state.js';

export const MEALS = [
  { key: 'breakfast', label: 'Zajtrk' },
  { key: 'lunch', label: 'Kosilo' },
  { key: 'dinner', label: 'Večerja' },
  { key: 'snack', label: 'Prigrizki' }
];

export const DEFAULT_GOALS = { kcal: 2400, protein: 160, carbs: 260, fat: 75 };
const OFF = 'https://world.openfoodfacts.org';
const OFF_FIELDS = 'code,product_name,product_name_sl,product_name_en,generic_name,brands,nutriments,serving_quantity';

export function nutritionEnabled(data) {
  return !!(data.settings.toggles && data.settings.toggles.nutrition);
}

export function ensureNutrition(data) {
  if (!data.nutrition) data.nutrition = { log: {}, products: {} };
  if (!data.nutrition.log) data.nutrition.log = {};
  if (!data.nutrition.products) data.nutrition.products = {};
  return data.nutrition;
}

export function goalsOf(data) {
  return { ...DEFAULT_GOALS, ...(data.settings.nutritionGoals || {}) };
}

function round1(x) { return Math.round(x * 10) / 10; }

export function macrosFor(entry) {
  const f = (Number(entry.grams) || 0) / 100;
  const p = entry.per100 || {};
  return { kcal: (p.kcal || 0) * f, protein: (p.protein || 0) * f, carbs: (p.carbs || 0) * f, fat: (p.fat || 0) * f };
}

export function dayEntries(data, iso) {
  return ((data.nutrition && data.nutrition.log[iso]) || []);
}

export function dayTotals(data, iso) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, byMeal: {} };
  for (const m of MEALS) totals.byMeal[m.key] = { kcal: 0, entries: [] };
  for (const e of dayEntries(data, iso)) {
    const m = macrosFor(e);
    totals.kcal += m.kcal; totals.protein += m.protein; totals.carbs += m.carbs; totals.fat += m.fat;
    const meal = totals.byMeal[e.meal] || totals.byMeal.snack;
    meal.kcal += m.kcal;
    meal.entries.push(e);
  }
  return totals;
}

// Averages over days that have at least one entry, between two ISO dates.
export function averageIntake(data, fromIso, toIso) {
  const log = (data.nutrition && data.nutrition.log) || {};
  const days = Object.keys(log).filter(iso => iso >= fromIso && iso <= toIso && log[iso].length);
  if (!days.length) return null;
  const sum = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const iso of days) { const t = dayTotals(data, iso); sum.kcal += t.kcal; sum.protein += t.protein; sum.carbs += t.carbs; sum.fat += t.fat; }
  return { days: days.length, kcal: sum.kcal / days.length, protein: sum.protein / days.length, carbs: sum.carbs / days.length, fat: sum.fat / days.length };
}

// ---- products

function productKey(p) { return p.code ? `code:${p.code}` : p.key || `own:${uid()}`; }

export function allProducts(data) {
  return Object.values(ensureNutrition(data).products);
}

export function ownProducts(data) {
  return allProducts(data).filter(p => p.source === 'own').sort((a, b) => a.name.localeCompare(b.name));
}

export function saveProduct(data, product) {
  const n = ensureNutrition(data);
  const p = { ...product, key: product.key || productKey(product), updatedAt: Date.now() };
  n.products[p.key] = p;
  return p;
}

export function deleteProduct(data, key) {
  delete ensureNutrition(data).products[key];
}

export function findByCode(data, code) {
  return ensureNutrition(data).products[`code:${String(code).trim()}`] || null;
}

// Products used recently, newest first (for the quick-add list).
export function recentProducts(data, limit = 15) {
  const n = ensureNutrition(data);
  const seen = new Set(), out = [];
  const days = Object.keys(n.log).sort().reverse();
  for (const iso of days) {
    for (const e of [...n.log[iso]].reverse()) {
      const key = e.productKey || (e.code ? `code:${e.code}` : `name:${e.name}`);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(n.products[key] || { key, name: e.name, brand: e.brand, code: e.code, per100: e.per100, servingG: e.servingG, source: 'log' });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function searchLocal(data, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return allProducts(data)
    .filter(p => `${p.name} ${p.brand || ''} ${p.code || ''}`.toLowerCase().includes(q))
    .sort((a, b) => (a.source === 'own' ? -1 : 0) - (b.source === 'own' ? -1 : 0) || a.name.localeCompare(b.name))
    .slice(0, 30);
}

// ---- Open Food Facts

export function normalizeOff(p) {
  if (!p) return null;
  const n = p.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184; // kJ → kcal
  const name = (p.product_name_sl || p.product_name || p.product_name_en || p.generic_name || '').trim();
  const product = {
    code: String(p.code || '').trim(),
    name: name || 'Neznan izdelek',
    brand: String(p.brands || '').split(',')[0].trim(),
    per100: {
      kcal: kcal != null ? Math.round(Number(kcal)) : null,
      protein: n.proteins_100g != null ? round1(Number(n.proteins_100g)) : null,
      carbs: n.carbohydrates_100g != null ? round1(Number(n.carbohydrates_100g)) : null,
      fat: n.fat_100g != null ? round1(Number(n.fat_100g)) : null
    },
    servingG: Number(p.serving_quantity) > 0 ? Math.round(Number(p.serving_quantity)) : null,
    source: 'off'
  };
  product.complete = product.per100.kcal != null && !!name;
  return product;
}

async function getJson(url, timeoutMs = 12000) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined });
    if (!res.ok && res.status !== 404) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    if (t) clearTimeout(t);
  }
}

export async function fetchOffProduct(code) {
  const json = await getJson(`${OFF}/api/v2/product/${encodeURIComponent(code)}?fields=${OFF_FIELDS}`);
  if (!json || json.status === 0 || !json.product) return null;
  return normalizeOff({ code, ...json.product });
}

export async function searchOff(query) {
  const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=25&fields=${OFF_FIELDS}`;
  const json = await getJson(url, 15000);
  return (json.products || []).map(normalizeOff).filter(p => p && p.complete);
}

// Own/cached product first, then Open Food Facts. Returns { product, from } or
// { product: null, partial } when the code is unknown or has no nutrition data.
export async function lookupBarcode(data, code) {
  const local = findByCode(data, code);
  if (local && local.per100 && local.per100.kcal != null) return { product: local, from: local.source === 'own' ? 'own' : 'cache' };
  const off = await fetchOffProduct(code);
  if (off && off.complete) return { product: off, from: 'off' };
  return { product: null, partial: off };
}

// ---- log entries

export function addEntry(data, iso, product, grams, meal) {
  const n = ensureNutrition(data);
  if (product.source === 'off' && product.code) saveProduct(data, product); // cache for offline reuse
  const entry = {
    id: uid(), meal, grams: Number(grams) || 0, at: Date.now(),
    productKey: product.key || (product.code ? `code:${product.code}` : null),
    name: product.name, brand: product.brand || '', code: product.code || '',
    per100: { ...product.per100 }, servingG: product.servingG || null
  };
  (n.log[iso] = n.log[iso] || []).push(entry);
  return entry;
}

export function updateEntry(data, iso, id, patch) {
  const list = dayEntries(data, iso);
  const e = list.find(x => x.id === id);
  if (e) Object.assign(e, patch);
}

export function removeEntry(data, iso, id) {
  const n = ensureNutrition(data);
  n.log[iso] = (n.log[iso] || []).filter(x => x.id !== id);
  if (!n.log[iso].length) delete n.log[iso];
}

// Rough starting goals from bodyweight: protein 2 g/kg, fat 0.9 g/kg,
// maintenance ≈ 33 kcal/kg, cut −400 kcal, lean bulk +250 kcal.
export function suggestGoals(weightKg, mode) {
  const w = Number(weightKg) || 80;
  const maintenance = w * 33;
  const kcal = Math.round((mode === 'cut' ? maintenance - 400 : mode === 'bulk' ? maintenance + 250 : maintenance) / 50) * 50;
  const protein = Math.round(w * 2);
  const fat = Math.round(w * 0.9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
}
