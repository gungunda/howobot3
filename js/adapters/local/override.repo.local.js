// js/adapters/local/override.repo.local.js
// Репозиторий оверрайдов: без устаревшего progress.

const KEY = "planner.overrides";

function clampPct(p) { return Math.max(0, Math.min(100, Math.round(p))); }

function normalizeTask(t) {
  if (!t || typeof t !== "object") return t;
  const { id, title, minutes = 0, donePercent = 0, done = undefined, meta = undefined } = t;
  const pct = clampPct(Number(donePercent) || 0);
  const normalized = {
    id: String(id ?? ""),
    title: String(title ?? ""),
    minutes: Math.max(0, Number(minutes) || 0),
    donePercent: pct,
    done: typeof done === "boolean" ? done : pct >= 100
  };
  if (meta && typeof meta === "object") normalized.meta = meta;
  return normalized;
}

function normalizeOverride(ov) {
  if (!ov || typeof ov !== "object") return null;
  const dateKey = String(ov.dateKey || "");
  const tasks = Array.isArray(ov.tasks) ? ov.tasks.map(normalizeTask) : [];
  return { dateKey, tasks };
}

function loadAll() {
  try {
    const raw = (typeof localStorage !== "undefined") ? localStorage.getItem(KEY) : null;
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (data && typeof data === "object") {
      // Глубоко нормализуем и выкидываем возможные progress из старых записей
      const out = {};
      for (const k of Object.keys(data)) {
        const ov = normalizeOverride(data[k]);
        if (ov) out[k] = ov;
      }
      return out;
    }
  } catch (e) {
    console.warn("[override.repo.local] loadAll error:", e?.message);
  }
  return {};
}

function saveAll(obj) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(obj || {}));
    return true;
  } catch (e) {
    console.warn("[override.repo.local] saveAll error:", e?.message);
    return false;
  }
}

export async function loadOverride(dateKey) {
  const all = loadAll();
  const ov = all?.[dateKey];
  return normalizeOverride(ov);
}

export async function saveOverride(overrideObj) {
  const ov = normalizeOverride(overrideObj);
  if (!ov || !ov.dateKey) return false;
  const all = loadAll();
  all[ov.dateKey] = ov;
  return saveAll(all);
}

export async function deleteOverride(dateKey) {
  const all = loadAll();
  if (dateKey in all) {
    delete all[dateKey];
    return saveAll(all);
  }
  return true;
}

export async function listOverrides() {
  const all = loadAll();
  return Object.keys(all);
}

export const load = loadOverride;
export const save = saveOverride;
export default { loadOverride, saveOverride, deleteOverride, listOverrides, load, save };
