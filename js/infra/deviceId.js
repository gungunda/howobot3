// /js/infra/deviceId.js
const LS_KEY = "planner.deviceId";

export function isBad(value) {
  if (value == null) return true;
  const s = String(value).trim();
  if (s === "" || s === "0") return true;
  const low = s.toLowerCase();
  if (low === "null" || low === "undefined" || low === "nan") return true;
  if (s.length < 4) return true;
  if (/[\s\u0000-\u001f]/.test(s)) return true;
  return false;
}

function readRaw() { try { return localStorage.getItem(LS_KEY); } catch { return null; } }
function writeRaw(id) { try { if (id != null) localStorage.setItem(LS_KEY, String(id)); } catch {} }

function genId() {
  const a = Date.now().toString(36);
  const b = Math.random().toString(36).slice(2, 6);
  return `dev_${a}_${b}`;
}

export function ensure() {
  try {
    if (typeof window !== "undefined" && window.__DEVICE_ID__) {
      const v = String(window.__DEVICE_ID__);
      if (!isBad(v)) { writeRaw(v); return v; }
    }
  } catch {}
  const existing = readRaw();
  if (!isBad(existing)) return existing;
  const fresh = genId();
  writeRaw(fresh);
  return fresh;
}

export function get() { return ensure(); }
