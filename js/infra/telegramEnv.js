const tg = (function getTelegramWebApp() {
  if (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
})();

function withTimeout(promise, ms = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Telegram CloudStorage timeout")), ms);
    promise.then(v => { clearTimeout(t); resolve(v); })
           .catch(e => { clearTimeout(t); reject(e); });
  });
}

const Cloud = (() => {
  const supported =
    !!(tg &&
       tg.CloudStorage &&
       typeof tg.CloudStorage.getItem === "function" &&
       typeof tg.CloudStorage.setItem === "function");

  if (!supported) return { supported: false };

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

  return { supported: true, getItem, setItem, removeItems, getKeys };
})();

export const Storage = (() => {
  let mode = Cloud.supported ? "cloud_probe" : "local";

  function telegramVersion() {
    try { return parseFloat(tg?.version ?? "0.0"); } catch (_) { return 0; }
  }

  async function probeCloud() {
    const k = "__probe__";
    const v = String(Date.now());
    try {
      const okSet = await Cloud.setItem(k, v);
      const back  = await Cloud.getItem(k);
      await Cloud.removeItems([k]).catch(() => {});
      return okSet && back === v;
    } catch (err) {
      console.warn("[Storage] probeCloud failed:", err);
      if (window.debugLog) window.debugLog("[Storage] probeCloud failed", String(err));
      return false;
    }
  }

  async function init() {
    const ver = telegramVersion();
    const isInTelegram = !!tg;
    if (isInTelegram) { try { tg.expand(); } catch(_) {} }

    if (Cloud.supported && ver >= 6.2) {
      try {
        const ok = await probeCloud();
        mode = ok ? "cloud" : "local";
      } catch (err) {
        console.warn("[Storage.init] probeCloud threw:", err);
        mode = "local";
      }
    } else if (Cloud.supported && ver < 6.2) {
      console.warn("[Storage.init] Telegram version", ver, "< 6.2, fallback local.");
      mode = "local";
    } else {
      mode = "local";
    }

    console.log(`[Storage.init] Telegram detected=${isInTelegram}, version=${ver}, mode=${mode}`);
    if (window.debugLog)
      window.debugLog("[Storage.init]", "tg=", isInTelegram, "ver=", ver, "mode=", mode);
  }

  function getMode() { return mode; }
  function isTelegramEnv() { return !!tg; }

  async function getItem(key) {
    if (mode === "cloud" && Cloud.supported) {
      try {
        const v = await Cloud.getItem(key);
        if (window.debugLog) window.debugLog("[Storage.getItem]", key, "from CLOUD =", v);
        return v;
      } catch (e) {
        console.warn("[Storage.getItem] Cloud failed → local:", e);
        if (window.debugLog) window.debugLog("[Storage.getItem]", key, "cloud FAIL → local");
        mode = "local";
      }
    }
    try {
      const v = localStorage.getItem(key);
      if (window.debugLog) window.debugLog("[Storage.getItem]", key, "from LOCAL =", v);
      return v;
    } catch (err) {
      console.warn("[Storage.getItem] localStorage failed:", err);
      if (window.debugLog) window.debugLog("[Storage.getItem]", key, "LOCAL FAIL", String(err));
      return null;
    }
  }

  async function setItem(key, value) {
    console.log("[Storage.setItem] mode =", mode, "key =", key);
    if (mode === "cloud" && Cloud.supported) {
      try {
        const ok = await Cloud.setItem(key, value);
        if (ok) {
          console.log("[Storage.setItem] saved to CLOUD ok");
          if (window.debugLog) window.debugLog("[Storage.setItem]", key, "→ CLOUD ok");
          return;
        }
        console.warn("[Storage.setItem] cloud returned !ok, fallback local");
        if (window.debugLog) window.debugLog("[Storage.setItem]", key, "cloud !ok → local");
        mode = "local";
      } catch (e) {
        console.warn("[Storage.setItem] Cloud failed → local:", e);
        if (window.debugLog) window.debugLog("[Storage.setItem]", key, "EXC → local");
        mode = "local";
      }
    }
    try {
      localStorage.setItem(key, value);
      console.log("[Storage.setItem] saved to LOCAL ok");
      if (window.debugLog) window.debugLog("[Storage.setItem]", key, "→ LOCAL ok");
    } catch (err) {
      console.error("[Storage.setItem] localStorage FAILED:", err);
      if (window.debugLog) window.debugLog("[Storage.setItem]", key, "LOCAL FAIL", String(err));
    }
  }

  async function removeItems(keysArray) {
    if (!Array.isArray(keysArray)) return;
    if (mode === "cloud" && Cloud.supported) {
      try {
        await Cloud.removeItems(keysArray);
        console.log("[Storage.removeItems] cloud ok", keysArray);
        if (window.debugLog) window.debugLog("[Storage.removeItems]", keysArray.join(","), "CLOUD ok");
        return;
      } catch (e) {
        console.warn("[Storage.removeItems] Cloud failed → local:", e);
        if (window.debugLog) window.debugLog("[Storage.removeItems]", "CLOUD FAIL → local");
        mode = "local";
      }
    }
    for (const k of keysArray) {
      try {
        localStorage.removeItem(k);
        console.log("[Storage.removeItems] local ok", k);
        if (window.debugLog) window.debugLog("[Storage.removeItems]", k, "LOCAL ok");
      } catch (err) {
        console.error("[Storage.removeItems] local remove FAILED:", err, k);
        if (window.debugLog) window.debugLog("[Storage.removeItems]", k, "LOCAL FAIL", String(err));
      }
    }
  }

  async function getKeys() {
    if (mode === "cloud" && Cloud.supported) {
      try {
        const arr = await Cloud.getKeys();
        console.log("[Storage.getKeys] cloud keys =", arr);
        if (window.debugLog) window.debugLog("[Storage.getKeys]", "CLOUD =", arr);
        return arr;
      } catch (e) {
        console.warn("[Storage.getKeys] Cloud failed → local:", e);
        if (window.debugLog) window.debugLog("[Storage.getKeys]", "CLOUD FAIL → local");
        mode = "local";
      }
    }
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k != null) out.push(k);
      }
    } catch (err) {
      console.warn("[Storage.getKeys] localStorage iteration failed:", err);
    }
    console.log("[Storage.getKeys] local keys =", out);
    if (window.debugLog) window.debugLog("[Storage.getKeys]", "LOCAL =", out);
    return out;
  }

  return { init, getMode, isTelegramEnv, getItem, setItem, removeItems, getKeys };
})();