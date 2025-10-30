import { json } from "./_utils.js";

async function readPayload(req) {
  // Универсальный парсер тела для Vercel Node — работает и когда req.body не распарсен.
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  let data = "";
  return await new Promise((resolve) => {
    req.setEncoding("utf8");
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    const r = json({ ok: false, error: "method_not_allowed" }, 405);
    res.status(r.status).setHeader("content-type", r.headers["content-type"]).send(r.body);
    return;
  }
  const payload = await readPayload(req);
  try {
    const result = await logic(payload);
    res.status(result.status).setHeader("content-type", result.headers["content-type"]).send(result.body);
  } catch (e) {
    const r = json({ ok:false, error:"exception", detail:String(e && e.message || e) }, 500);
    res.status(r.status).setHeader("content-type", r.headers["content-type"]).send(r.body);
  }
}

async function logic(payload) {

  const {{ parseInitData, getOverride }} = await import("./_utils.js");
  const parsed  = parseInitData(payload?.initData);
  const dateKey = payload?.dateKey;
  if (!dateKey) return json({{ ok:false, error:"bad_dateKey" }}, 400);
  const ov = await getOverride(parsed.userId, dateKey);
  return json({{ ok:true, override: ov || null }});

}
