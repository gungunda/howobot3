// js/app.js
import { Storage } from "./infra/telegramEnv.js";
import SyncService from "./sync/syncService.js";
import { ensure as ensureDeviceId } from "./infra/deviceId.js";
import { initUI, getState, refreshDashboard, refreshScheduleEditor } from "./ui/events.js";

function log(level, scope, msg, obj) {
  if (window.__UILOG) window.__UILOG(level, scope, msg, obj);
  else console.log(level, `[${scope}] ${msg}`, obj || "");
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    log("INF", "app", "DOM ready");
    ensureDeviceId();
    await Storage.init();
    log("INF", "app", `Storage mode = ${Storage.getMode && Storage.getMode()}`);
    await initUI();

    window.addEventListener("sync:apply:schedule", async (ev) => {
      try {
        const { schedule, meta } = ev.detail || {};
        if (!schedule) return;
        const state = getState && getState();
        if (state?.activeView === "schedule") {
          await refreshScheduleEditor();
        } else if (state?.activeView === "dashboard") {
          await refreshDashboard(state.selectedDateKey);
        }
        log("LOG", "app", "schedule applied from server", meta || {});
      } catch (e) {
        log("WRN", "app", "failed to apply schedule from server", { error: String(e) });
      }
    });

    window.addEventListener("sync:apply:override", async (ev) => {
      try {
        const { dateKey, meta } = ev.detail || {};
        if (!dateKey) return;
        const state = getState && getState();
        if (state?.activeView === "dashboard" && state?.selectedDateKey === dateKey) {
          await refreshDashboard(state.selectedDateKey);
        }
        log("LOG", "app", `override applied for ${dateKey}`, meta || {});
      } catch (e) {
        log("WRN", "app", "failed to apply override from server", { error: String(e) });
      }
    });

    SyncService.startPolling(30_000);
  } catch (e) {
    log("WRN", "app", "bootstrap failed", { error: String(e) });
  }
});
