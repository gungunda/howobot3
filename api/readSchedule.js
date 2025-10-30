const { json, parseInitData, getSchedule } = require("./_utils.js");

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
    const r = json({ ok:false, error:"method_not_allowed" }, 405);
    res.status(r.status).setHeader("content-type", r.headers["content-type"]).send(r.body); return;
  }
  const payload = await readPayload(req);
  const parsed = parseInitData(payload?.initData);
  const rec = await getSchedule(parsed.userId);
  const r = rec
    ? json({ ok:true, schedule: rec.schedule, meta: rec.meta || null })
    : json({ ok:true, schedule: null });
  res.status(r.status).setHeader("content-type", r.headers["content-type"]).send(r.body);
};
