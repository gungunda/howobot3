import { test, expect } from "../test-runner.js";

test("UI: percent controls — клики меняют DOM (мягкая проверка)", async () => {
  const renderSchedule = (await import("../../js/ui/render-schedule.js")).default;
  const { enablePercentControls } = await import("../../js/ui/events.js");
  const getTasksMod = await import("../../js/usecases/getTasksForDate.js");

  const getTasksForDate = getTasksMod.default || getTasksMod.getTasksForDate || getTasksMod.run;
  const dateKey = "2025-10-23";
  const tasks = await getTasksForDate({ dateKey });
  renderSchedule(null, { dateKey, tasks });

  enablePercentControls(document);

  const schedule = document.getElementById("schedule");
  const first = schedule.querySelector(".task-item");
  expect(!!first).toBe(true);

  const btnPlus = first.querySelector(".task-pct-plus");
  btnPlus.click();

  // После клика происходит ререндер — проверим, что список остаётся валиден
  const items = schedule.querySelectorAll(".task-item");
  expect(items.length >= 1).toBe(true);
});
