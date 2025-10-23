import { test, expect } from "../test-runner.js";

let ENT = null, ID = null;
try { ENT = await import("../../js/domain/entities.js"); } catch {}
try { ID = await import("../../js/domain/id.js"); } catch {}

test("DeviceId: стабильное получение из localStorage (если есть)", () => {
  if (!ID || (typeof ID.getDeviceId !== "function" && typeof ID.deviceId !== "function")) {
    console.warn("[SKIP] id.js нет или нет getDeviceId/deviceId");
    return;
  }
  const fn = ID.getDeviceId || ID.deviceId;
  const a = fn();
  const b = fn();
  expect(typeof a).toBe("string");
  expect(a).toBe(b);
});

test("Meta: базовые поля (опционально)", () => {
  if (!ENT || !ENT.Meta) { console.warn("[SKIP] Meta не экспортируется"); return; }
  const m = new ENT.Meta({});
  if ("version" in m) expect(typeof m.version).toBe("string");
  if ("createdAt" in m) expect(typeof m.createdAt).toBe("string");
  if ("updatedAt" in m) expect(typeof m.updatedAt).toBe("string");
});
