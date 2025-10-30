import { json, parseInitData, getOverride } from "./_utils.js";

export async function POST(req) {
  let payload = {};
  try { payload = await req.json(); } catch {}
  const initData = payload?.initData || null;
  const dateKey  = payload?.dateKey;

  const parsed = parseInitData(initData);
  if (!parsed) return json({ ok: false, error: "bad_init_data" }, 400);
  if (!dateKey) return json({ ok: false, error: "bad_dateKey" }, 400);

  const ov = getOverride(parsed.userId, dateKey);
  return json({ ok: true, override: ov || null });
}

export const runtime = "edge";
