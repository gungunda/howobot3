// api/listVersions.js — версии (маяки) расписания и оверрайдов (Node)

import { kv } from "@vercel/kv";
import { ok, badRequest, serverError, resolveInitData, userKey, KEYS } from "./_utils.js";

export default async function handler(req, res) {
  try {
    const initData = await resolveInitData(req);
    const uk = userKey(initData);
    if (!uk) return badRequest(res, "bad_init_data");

    const scheduleMeta = (await kv.get(KEYS.scheduleMeta(uk))) || null;

    const dates = await kv.smembers(KEYS.overrideIndex(uk)).catch(() => []);
    const overridesMeta = {};
    if (Array.isArray(dates)) {
      for (const d of dates) {
        const m = await kv.get(KEYS.overrideMeta(uk, d));
        if (m) overridesMeta[d] = m;
      }
    }

    return ok(res, { scheduleMeta, overridesMeta });
  } catch (e) {
    return serverError(res, e);
  }
}
