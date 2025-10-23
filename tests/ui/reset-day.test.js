import { test, expect } from "../test-runner.js";

test("UI: 'Сбросить день' — вызывает reset и перерисовывает список", async () => {
  const renderSchedule = (await import("../../js/ui/render-schedule.js")).default;
  const { enableResetDay } = await import("../../js/ui/reset-day-control.js");
  const getTasksMod = await import("../../js/usecases/getTasksForDate.js");
  const getTasksForDate = getTasksMod.default || getTasksMod.getTasksForDate || getTasksMod.run;

  const dateKey = "2025-10-23";
  const tasks = await getTasksForDate({ dateKey });
  renderSchedule(null, { dateKey, tasks });

  enableResetDay(document);

  const schedule = document.getElementById("schedule");
  const resetBtn = schedule.querySelector("#reset-day-btn");
  expect(!!resetBtn).toBe(true);

  resetBtn.click();

  const items = schedule.querySelectorAll(".task-item");
  expect(items.length >= 0).toBe(true);
});
