// api/writeOverride.js — запись override + индекс + маяк (Node)

import { kv } from "@vercel/kv";
import { ok, badRequest, serverError, readJsonBody, resolveInitData, userKey, KEYS } from "./_utils.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return badRequest(res, "method_not_allowed");

    const initData = await resolveInitData(req);
    const uk = userKey(initData);
    if (!uk) return badRequest(res, "bad_init_data");

    const body = await readJsonBody(req).catch(() => ({}));
    const dateKey = body?.dateKey;
    const override = body?.override;
    const clientMeta = body?.clientMeta || {};

    if (!dateKey || !override || typeof override !== "object") {
      return badRequest(res, "bad_payload");
    }

    const serverMeta = {
      updatedAt: new Date().toISOString(),
      deviceId: typeof clientMeta.deviceId === "string" ? clientMeta.deviceId : null
    };

    await kv.set(KEYS.override(uk, dateKey), override);
    await kv.set(KEYS.overrideMeta(uk, dateKey), serverMeta);
    await kv.sadd(KEYS.overrideIndex(uk), dateKey);
    await kv.set(KEYS.beacon(uk), serverMeta);

    return ok(res, { applied: true, serverMeta });
  } catch (e) {
    return serverError(res, e);
  }
}
