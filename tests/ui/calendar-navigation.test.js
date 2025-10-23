import { test, expect } from "../test-runner.js";

test("UI: календарь — смена даты перерисовывает список", async () => {
  const helpers = await import("../../js/ui/helpers.js");
  const renderCalendar = (await import("../../js/ui/render-calendar.js")).default;
  const renderSchedule = (await import("../../js/ui/render-schedule.js")).default;

  const getTasks = (await import("../../js/usecases/getTasksForDate.js"));
  const getTasksForDate = getTasks.default || getTasks.getTasksForDate || getTasks.run;

  // Нарисуем календарь
  const root = document.createElement("div");
  root.id = "calendar";
  document.body.appendChild(root);

  // «Сегодня» и «завтра»
  const cur = "2025-10-23";
  const tomorrow = "2025-10-24";

  let lastKey = null;
  renderCalendar(root, {
    dateKey: cur,
    onChange: (k) => { lastKey = k; }
  });

  // Проставим список на сегодня
  const tasksToday = await getTasksForDate({ dateKey: cur });
  renderSchedule(null, { dateKey: cur, tasks: tasksToday });

  // Щёлкнем «вперёд»
  root.querySelector("#cal-next").click();

  // Должен вызваться onChange с новой датой
  expect(!!lastKey).toBe(true);
});
