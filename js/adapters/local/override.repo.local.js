// js/adapters/local/override.repo.local.js
const KEY = "planner.overrides";

function clampPct(p){ return Math.max(0, Math.min(100, Math.round(Number(p)||0))); }
function normTask(t){
  if(!t || typeof t !== "object") return t;
  const pct = clampPct(t.donePercent || 0);
  return {
    id: String(t.id || ""),
    title: String(t.title || ""),
    minutes: Math.max(0, Number(t.minutes) || 0),
    donePercent: pct,
    done: typeof t.done === "boolean" ? t.done : (pct >= 100),
    ...(t.meta ? { meta: t.meta } : {}),
  };
}
function normOv(ov){
  if(!ov || typeof ov !== "object") return null;
  return { dateKey: String(ov.dateKey || ""), tasks: Array.isArray(ov.tasks) ? ov.tasks.map(normTask) : [] };
}
function loadAll(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return {};
    const data = JSON.parse(raw);
    const out = {};
    for(const k of Object.keys(data || {})){
      const n = normOv(data[k]);
      if(n && n.dateKey) out[k] = n;
    }
    return out;
  }catch{ return {}; }
}
function saveAll(obj){
  try{ localStorage.setItem(KEY, JSON.stringify(obj || {})); return true; }catch{ return false; }
}

export async function loadOverride(dateKey){
  const all = loadAll();
  const ov = all?.[dateKey];
  return ov ? normOv(ov) : null;
}
export async function saveOverride(ov){
  const n = normOv(ov);
  if(!n || !n.dateKey) return false;
  const all = loadAll();
  all[n.dateKey] = n;
  return saveAll(all);
}
export async function deleteOverride(dateKey){
  const all = loadAll();
  if(dateKey in all){ delete all[dateKey]; return saveAll(all); }
  return true;
}
export async function listOverrides(){
  const all = loadAll();
  return Object.keys(all);
}
export default { loadOverride, saveOverride, deleteOverride, listOverrides };
