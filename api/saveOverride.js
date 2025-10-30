import { json, parseInitData, getOverride, putOverride } from "./_utils.js";

export async function POST(req) {
  let payload = {};
  try { payload = await req.json(); } catch {}
  const initData = payload?.initData || null;
  const dateKey  = payload?.dateKey;
  const override = payload?.override || null;

  const parsed = parseInitData(initData);
  if (!parsed) return json({ ok: false, error: "bad_init_data" }, 400);
  if (!dateKey || !override) return json({ ok: false, error: "bad_payload" }, 400);

  const server = getOverride(parsed.userId, dateKey);
  const serverUpdatedAt = server?.meta?.updatedAt || null;
  const clientUpdatedAt = override?.meta?.updatedAt || null;

  if (serverUpdatedAt && clientUpdatedAt && serverUpdatedAt > clientUpdatedAt) {
    return json({ ok: true, applied: false, reason: "stale" });
  }

  // Запоминаем, как прислали (meta.updatedAt/deviceId уже стоят на клиенте)
  putOverride(parsed.userId, dateKey, override);

  return json({ ok: true, applied: true });
}

export const runtime = "edge";
