// api/readOverride.js — чтение override по дате (Node)

import { kv } from "@vercel/kv";
import { ok, badRequest, serverError, readJsonBody, resolveInitData, userKey, KEYS } from "./_utils.js";

export default async function handler(req, res) {
  try {
    const initData = await resolveInitData(req);
    const uk = userKey(initData);
    if (!uk) return badRequest(res, "bad_init_data");

    const body = await readJsonBody(req).catch(() => ({}));
    const dateKey = body?.dateKey || null;
    if (!dateKey) return badRequest(res, "bad_payload");

    const override = await kv.get(KEYS.override(uk, dateKey));
    const meta = await kv.get(KEYS.overrideMeta(uk, dateKey));

    return ok(res, { override: override || null, meta: meta || null });
  } catch (e) {
    return serverError(res, e);
  }
}
