// js/app.js
// Точка входа. Порядок:
// 1) Storage.init()
// 2) pullBootstrap() — пинг API (для логов)
// 3) pullFreshScheduleOnStart() — подтянуть серверное расписание в локалку
// 4) initUI()
// 5) startPolling(30s) — периодически тянуть обновления (schedule + overrides)

import { Storage } from "./infra/telegramEnv.js";
import SyncService, { startPolling } from "./sync/syncService.js";
import { initUI } from "./ui/events.js";

function setupDebugLog() {
  const el = document.getElementById("debug-log");
  if (!el) return;
  const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  function append(level, args) {
    try {
      const ts = new Date().toTimeString().split(" ")[0] + "." + String(performance.now().toFixed(0)).slice(-3);
      const line = `[${level}] ${ts} ${args.map(x => {
        if (typeof x === "string") return x;
        try { return JSON.stringify(x); } catch { return String(x); }
      }).join(" ")}`;
      el.textContent += (el.textContent ? "\n" : "") + line;
      el.scrollTop = el.scrollHeight;
    } catch {}
  }
  console.log = (...a) => { append("LOG", a); orig.log(...a); };
  console.info = (...a) => { append("INF", a); orig.info(...a); };
  console.warn = (...a) => { append("WRN", a); orig.warn(...a); };
  console.error = (...a) => { append("ERR", a); orig.error(...a); };
  console.info("[app] UI logger attached");
}

document.addEventListener("DOMContentLoaded", async () => {
  setupDebugLog();
  console.info("[app] DOM ready");

  try {
    await Storage.init();
    console.info("[app] Storage mode = " + Storage.getMode());

    await SyncService.pullBootstrap();
    await SyncService.pullFreshScheduleOnStart();

    await initUI();

    // Включаем фоновые обновления каждые 30 сек
    startPolling(30000);
  } catch (e) {
    console.error("[app] init failed:", e);
  }
});
