import { json } from "./_utils.js";
import { parseInitData, getOverride } from "./_utils.js";
async function logic(payload) {
  const parsed  = parseInitData(payload?.initData);
  const dateKey = payload?.dateKey;
  if (!dateKey) return json({ ok:false, error:"bad_dateKey" }, 400);
  const ov = await getOverride(parsed.userId, dateKey);
  return json({ ok:true, override: ov || null });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    const r = json({ ok:false, error: "method_not_allowed" }, 405);
    res.status(r.status).setHeader("content-type", r.headers["content-type"]).send(r.body);
    return;
  }
  let payload = {};
  try {
    // If content-type is JSON and body already parsed by Vercel
    if (req.body && typeof req.body === "object") payload = req.body;
    else if (typeof req.body === "string" && req.body.length) payload = JSON.parse(req.body);
  } catch (e) {}

  try {
    const result = await logic(payload);
    res.status(result.status).setHeader("content-type", result.headers["content-type"]).send(result.body);
  } catch (e) {
    const r = json({ ok:false, error:"exception", detail:String(e && e.message || e) }, 500);
    res.status(r.status).setHeader("content-type", r.headers["content-type"]).send(r.body);
  }
}
