import { test, expect } from "../test-runner.js";

test("UI: renderSchedule — рисует N элементов .task-item", async () => {
  const mod = await import("../../js/ui/render-schedule.js");
  const renderSchedule = mod.default || mod.renderSchedule;

  const root = document.createElement("div");
  root.id = "schedule";
  document.body.appendChild(root);

  const tasks = [
    { id: "t1", title: "Математика", minutes: 20, done: false },
    { id: "t2", title: "Чтение", minutes: 15, done: true }
  ];

  renderSchedule(root, { dateKey: "2025-10-23", tasks });

  const items = root.querySelectorAll(".task-item");
  expect(items.length).toBe(2);
});
