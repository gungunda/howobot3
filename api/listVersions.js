import { json, parseInitData, getSnapshot } from "./_utils.js";

export async function POST(req) {
  let payload = {};
  try { payload = await req.json(); } catch {}
  const parsed = parseInitData(payload?.initData || null);
  if (!parsed) return json({ ok: false, error: "bad_init_data" }, 400);
  const snap = await getSnapshot(parsed.userId);
  const scheduleMeta = snap.schedule?.meta || null;
  const overridesMeta = {};
  const ov = snap.overrides || {};
  for (const [dateKey, val] of Object.entries(ov)) {
    overridesMeta[dateKey] = { updatedAt: val?.meta?.updatedAt || null };
  }
  return json({ ok: true, schedule: scheduleMeta, overrides: overridesMeta });
}
export const runtime = "nodejs";
