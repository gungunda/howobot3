"use strict";

/**
 * DeviceId — простой провайдер идентификатора устройства.
 * Нужен для меток в метаданных (кто и когда менял).
 */
export const DeviceId = {
  _provider() {
    try {
      if (typeof window !== "undefined" && window.__DEVICE_ID__) {
        return String(window.__DEVICE_ID__);
      }
      if (typeof localStorage !== "undefined") {
        const v = localStorage.getItem("deviceId");
        if (v) return String(v);
      }
    } catch (_) {}
    return "0";
  },
  get() { return this._provider(); },
  setProvider(fn) { if (typeof fn === "function") this._provider = fn; }
};
