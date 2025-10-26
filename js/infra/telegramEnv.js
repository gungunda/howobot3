// js/infra/telegramEnv.js
// (same content as previous response)
const tg = (function getTelegramWebApp() {
  if (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
})();
function withTimeout(promise, ms = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Telegram CloudStorage timeout")), ms);
    promise
      .then(v => { clearTimeout(t); resolve(v); })
      .catch(e => { clearTimeout(t); reject(e); });
  });
}
const Cloud = (() => {
  const supported =
    !!(tg &&
       tg.CloudStorage &&
       typeof tg.CloudStorage.getItem === "function" &&
       typeof tg.CloudStorage.setItem === "function");
  if (!supported) {
    return { supported: false };
  }
  function getItem(key) {
    return withTimeout(new Promise((resolve, reject) => {
      tg.CloudStorage.getItem(key, (err, val) => {
        if (err) return reject(err);
        resolve(val ?? null);
      });
    }));
  }
  function setItem(key, value) {
    return withTimeout(new Promise((resolve, reject) => {
      tg.CloudStorage.setItem(key, value, (err, ok) => {
        if (err) return reject(err);
        resolve(ok === true);
      });
    }));
  }
  function removeItems(keysArray) {
    return withTimeout(new Promise((resolve, reject) => {
      tg.CloudStorage.removeItems(keysArray, (err, ok) => {
        if (err) return reject(err);
        resolve(ok === true);
      });
    }));
  }
  function getKeys() {
    return withTimeout(new Promise((resolve, reject) => {
      tg.CloudStorage.getKeys((err, arr) => {
        if (err) return reject(err);
        resolve(Array.isArray(arr) ? arr : []);
      });
    }));
  }
  return {
    supported: true,
    getItem,
    setItem,
    removeItems,
    getKeys
  };
})();
export const Storage = (() => {
  let mode = Cloud.supported ? "cloud_probe" : "local";
  async function probeCloud() {
    const probeKey = "__probe__";
    const probeVal = String(Date.now());
    try {
      const okSet = await Cloud.setItem(probeKey, probeVal);
      const back  = await Cloud.getItem(probeKey);
      await Cloud.removeItems([probeKey]).catch(() => {});
      return okSet && back === probeVal;
    } catch (_) {
      return false;
    }
  }
  async function init() {
    if (mode === "cloud_probe") {
      mode = (await probeCloud()) ? "cloud" : "local";
    }
    if (tg) {
      try { tg.expand(); } catch(_) {}
    }
  }
  function getMode() { return mode; }
  async function getItem(key) {
    if (mode === "cloud" && Cloud.supported) {
      try {
        return await Cloud.getItem(key);
      } catch (e) {
        console.warn("Cloud.getItem failed, fallback to local:", e);
        mode = "cloud_fallback";
      }
    }
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }
  async function setItem(key, value) {
    if (mode === "cloud" && Cloud.supported) {
      try {
        const ok = await Cloud.setItem(key, value);
        if (ok) return;
        mode = "cloud_fallback";
      } catch (e) {
        console.warn("Cloud.setItem failed, fallback to local:", e);
        mode = "cloud_fallback";
      }
    }
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }
  async function removeItems(keysArray) {
    if (!Array.isArray(keysArray)) return;
    if (mode === "cloud" && Cloud.supported) {
      try {
        await Cloud.removeItems(keysArray);
        return;
      } catch (e) {
        console.warn("Cloud.removeItems failed, fallback to local:", e);
        mode = "cloud_fallback";
      }
    }
    for (const k of keysArray) {
      try { localStorage.removeItem(k); } catch (_) {}
    }
  }
  async function getKeys() {
    if (mode === "cloud" && Cloud.supported) {
      try {
        return await Cloud.getKeys();
      } catch (e) {
        console.warn("Cloud.getKeys failed, fallback to local:", e);
        mode = "cloud_fallback";
      }
    }
    const out = [];
    try {
      for (let i=0; i<localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k != null) out.push(k);
      }
    } catch (_) {}
    return out;
  }
  return { init, getMode, getItem, setItem, removeItems, getKeys };
})();
