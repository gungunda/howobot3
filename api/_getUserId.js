import { verifyTelegramInitData } from "./_verifyTelegram.js";

/**
 * getUserIdOrFail(req, res)
 * - Достаёт initData из тела запроса.
 * - Валидирует подпись через verifyTelegramInitData.
 * - Если ок, возвращает { ok:true, userId }.
 * - Если не ок, сам шлёт ответ res.status(403)... и возвращает { ok:false }.
 *
 * Это чтобы не копипастить проверку в каждом handler.
 */
export async function getUserIdOrFail(req, res) {
  let body = req.body;
  if (!body) {
    // На Vercel в edge/node runtimes req.body может быть уже разобран
    // но в некоторых случаях придётся fallback на req.rawBody.
    try {
      body = JSON.parse(req.rawBody || "{}");
    } catch (e) {
      body = {};
    }
  }

  const initDataStr = body.initData;
  if (!initDataStr) {
    res.status(400).json({ ok: false, error: "missing initData" });
    return { ok: false };
  }

  const check = verifyTelegramInitData(initDataStr, process.env.BOT_TOKEN);
  if (!check.ok) {
    res.status(403).json({ ok: false, error: "auth-failed", reason: check.reason });
    return { ok: false };
  }

  return { ok: true, userId: check.userId, body };
}