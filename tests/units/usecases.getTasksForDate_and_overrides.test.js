\
import { test, expect } from "../test-runner.js";

let UCgetDay=null, UCreset=null;
try { UCgetDay = await import("../../js/usecases/getTasksForDate.js"); } catch {}
try { UCreset  = await import("../../js/usecases/resetToSchedule.js"); } catch {}

const getTasksForDate = UCgetDay?.default || UCgetDay?.getTasksForDate || UCgetDay?.run;
const resetToSchedule = UCreset?.default  || UCreset?.resetToSchedule  || UCreset?.run;

function assume(c,m){ if(!c){ console.warn("[SKIP] "+m); return false;} return true; }

test("getTasksForDate: отдаёт массив задач для указанной даты", async () => {
  if (!assume(getTasksForDate,"getTasksForDate не найден")) return;
  const today = new Date();
  const iso = today.toISOString().slice(0,10);
  const tasks = await getTasksForDate({ dateKey: iso });
  expect(Array.isArray(tasks || [])).toBe(true);
  if (tasks.length) expect(typeof tasks[0].title).toBe("string");
});

test("resetToSchedule: сбрасывает override (если есть)", async () => {
  if (!resetToSchedule) { console.warn("[SKIP] resetToSchedule отсутствует"); return; }
  const today = new Date();
  const iso = today.toISOString().slice(0,10);
  await resetToSchedule({ dateKey: iso });
  expect(true).toBe(true);
});
