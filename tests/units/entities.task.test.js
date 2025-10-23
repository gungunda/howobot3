import { test, expect } from "../test-runner.js";

function increaseProgress(t, delta) {
  t.progress = Math.min(100, (t.progress || 0) + delta);
  t.closed = t.progress === 100;
  return t;
}
function resetProgress(t) {
  t.progress = 0; t.closed = false; return t;
}

test("Task: increaseProgress до 100 закрывает задачу", () => {
  const t = { id: "a", title: "Математика", minutes: 30, progress: 90, closed: false };
  increaseProgress(t, 15);
  expect(t.progress).toBe(100);
  expect(t.closed).toBeTruthy();
});

test("Task: resetProgress сбрасывает прогресс и закрытие", () => {
  const t = { id: "a", title: "Математика", minutes: 30, progress: 100, closed: true };
  resetProgress(t);
  expect(t.progress).toBe(0);
  expect(t.closed).toBeFalsy();
});
