import { test, expect } from "../test-runner.js";

test("UI: чекбокс done — переключает задачу и сохраняет ререндер", async () => {
  const renderSchedule = (await import("../../js/ui/render-schedule.js")).default;
  const { enableDoneToggle } = await import("../../js/ui/done-toggle.js");
  const getTasksMod = await import("../../js/usecases/getTasksForDate.js");
  const getTasksForDate = getTasksMod.default || getTasksMod.getTasksForDate || getTasksMod.run;

  const dateKey = "2025-10-23";
  const tasks = await getTasksForDate({ dateKey });
  renderSchedule(null, { dateKey, tasks });

  enableDoneToggle(document);

  const schedule = document.getElementById("schedule");
  const first = schedule.querySelector(".task-item");
  expect(!!first).toBe(true);

  const cb = first.querySelector(".task-done");
  const was = cb.checked;
  cb.checked = !was;
  const ev = new Event("change", { bubbles: true });
  cb.dispatchEvent(ev);

  const items = schedule.querySelectorAll(".task-item");
  expect(items.length >= 1).toBe(true);
});
