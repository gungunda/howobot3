import { json, parseInitData, getSchedule } from "./_utils.js";

export async function POST(req) {
  let payload = {};
  try { payload = await req.json(); } catch {}
  const initData = payload?.initData || null;

  const parsed = parseInitData(initData);
  if (!parsed) return json({ ok: false, error: "bad_init_data" }, 400);

  const rec = getSchedule(parsed.userId);
  if (!rec) return json({ ok: true, schedule: null });

  return json({ ok: true, schedule: rec.schedule, meta: rec.meta || null });
}

export const runtime = "edge";
