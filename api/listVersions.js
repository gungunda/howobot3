const { json, parseInitData, getSnapshot } = require("./_utils.js");
const { json: _json } = require("./_utils.js");

async function readPayload(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  let data = ""; return await new Promise((resolve) => {
    req.setEncoding("utf8");
    req.on("data", (c) => data += c);
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    const r = _json({ ok:false, error:"method_not_allowed" }, 405);
    res.status(r.status).setHeader("content-type", r.headers["content-type"]).send(r.body); return;
  }
  const payload = await readPayload(req);

  const parsed = parseInitData(payload?.initData);
  const snap = await getSnapshot(parsed.userId);
  const scheduleMeta = snap.schedule?.meta || null;
  const overridesMeta = {};
  const ov = snap.overrides || {};
  for (const [dateKey, val] of Object.entries(ov)) {
    overridesMeta[dateKey] = { updatedAt: val?.meta?.updatedAt || null };
  }
  const r = json({ ok:true, schedule: scheduleMeta, overrides: overridesMeta });
  res.status(r.status).setHeader("content-type", r.headers["content-type"]).send(r.body);
};
