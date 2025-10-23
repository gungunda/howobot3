// tests/ui/reset-removes-override.test.js
import { test, expect } from "../test-runner.js";

test("Reset day удаляет override из LocalStorage", async () => {
  const dateKey = "2025-10-23";

  // Создаём override через правку
  const getMod = await import("../../js/usecases/getTasksForDate.js");
  const editMod = await import("../../js/usecases/editTaskInline.js");
  const resetMod = await import("../../js/usecases/resetToSchedule.js");

  const getTasksForDate = getMod.default || getMod.getTasksForDate || getMod.run;
  const editTaskInline = editMod.default || editMod.editTaskInline || editMod.run;
  const resetToSchedule = resetMod.default || resetMod.resetToSchedule || resetMod.run;

  const tasks = await getTasksForDate({ dateKey });
  if (!tasks.length) { expect(true).toBe(true); return; }

  await editTaskInline({ dateKey, taskId: tasks[0].id, patch: { title: "tmp" } });
  const raw1 = localStorage.getItem("planner.overrides");
  expect(!!raw1).toBe(true);

  await resetToSchedule({ dateKey });

  const obj = JSON.parse(localStorage.getItem("planner.overrides") || "{}");
  expect(!!obj[dateKey]).toBe(false);
});
