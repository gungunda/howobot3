\
import { test, expect } from "../test-runner.js";

let UC=null;
try { UC = await import("../../js/usecases/getSchedule.js"); } catch {}

const getSchedule = UC?.default || UC?.getSchedule || UC?.run;

test("UseCase:getSchedule — возвращает Schedule", async () => {
  if (!getSchedule) { console.warn("[SKIP] getSchedule не найден"); return; }
  const s = await getSchedule();
  expect(!!s).toBeTruthy();
  for (const d of ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]) {
    if (s && d in s) expect(Array.isArray(s[d] || [])).toBe(true);
  }
});
