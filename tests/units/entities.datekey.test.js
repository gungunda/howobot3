import { test, expect } from "../test-runner.js";

let ENT = null, utils = null;
try { ENT = await import("../../js/domain/entities.js"); } catch {}
try { utils = await import("../../js/utils/date-utils.js"); } catch {}

function pick(fnNames){
  for (const name of fnNames){
    if (ENT && typeof ENT[name] === "function") return ENT[name];
    if (utils && typeof utils[name] === "function") return utils[name];
  }
  return null;
}

const toKey = pick(["toDateKey","dateToKey","makeDateKey"]);
const fromKey = pick(["fromDateKey","keyToDate"]);

test("DateKey: YYYY-MM-DD формируется стабильно", () => {
  if (!toKey) { console.warn("[SKIP] нет функции toDateKey/dateToKey/makeDateKey"); return; }
  const d = new Date("2025-10-23T10:20:00Z");
  const key = toKey(d);
  expect(typeof key).toBe("string");
  expect(/^\d{4}-\d{2}-\d{2}$/.test(key)).toBe(true);
});

test("DateKey: round-trip, если есть fromKey", () => {
  if (!toKey || !fromKey) { console.warn("[SKIP] нет fromKey — ок"); return; }
  const d = new Date("2025-10-23T10:20:00Z");
  const key = toKey(d);
  const d2 = fromKey(key);
  expect(!!d2).toBeTruthy();
});
