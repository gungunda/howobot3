import { json, parseInitData, getSnapshot } from "./_utils.js";

export async function POST(req) {
  let payload = {};
  try { payload = await req.json(); } catch {}
  const initData = payload?.initData || null;

  const parsed = parseInitData(initData);
  if (!parsed) return json({ ok: false, error: "bad_init_data" }, 400);

  const snap = getSnapshot(parsed.userId) || {};
  // Вернём только мета (updatedAt) — как договаривались
  const scheduleMeta = snap.schedule?.meta || null;
  const overridesMeta = {};
  const ov = snap.overrides || {};
  for (const [dateKey, val] of Object.entries(ov)) {
    overridesMeta[dateKey] = { updatedAt: val?.meta?.updatedAt || null };
  }

  return json({
    ok: true,
    schedule: scheduleMeta,     // { updatedAt: "..." } | null
    overrides: overridesMeta    // { "YYYY-MM-DD": { updatedAt: "..." }, ... }
  });
}

export const runtime = "edge";
