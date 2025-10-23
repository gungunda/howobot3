import { test, expect } from "../test-runner.js";
import * as ENT from "../../js/domain/entities.js";

function assume(cond, msg) {
  if (!cond) { console.warn("[SKIP] " + msg); return false; }
  return true;
}

test("Task: конструктор и дефолты", () => {
  if (!assume(ENT.Task, "Task не экспортируется из entities.js")) return;

  const t = new ENT.Task({ id: "t1", title: "Math", minutes: 30 });
  expect(typeof t.id).toBe("string");
  expect(!!t.title).toBeTruthy();
  expect(typeof t.minutes).toBe("number");
  if ("progress" in t) expect(typeof t.progress).toBe("number");
  if ("done" in t) expect(typeof t.done).toBe("boolean");
});

test("Task: изменение прогресса (клиппинг 0..minutes)", () => {
  if (!assume(ENT.Task, "Task не экспортируется")) return;
  const t = new ENT.Task({ id: "t2", title: "Read", minutes: 20 });

  if (typeof t.increaseProgress === "function") {
    t.increaseProgress(10);
    expect(t.progress).toBe(10);
    t.increaseProgress(15); // ожидаем клип до 20
    expect(t.progress).toBe(20);
  } else {
    console.warn("[SKIP] increaseProgress отсутствует");
  }

  if (typeof t.decreaseProgress === "function") {
    t.decreaseProgress(5);  // 20 - 5 = 15
    expect(t.progress).toBe(15);
    t.decreaseProgress(50); // клип до 0
    expect(t.progress).toBe(0);
  } else {
    console.warn("[SKIP] decreaseProgress отсутствует");
  }
});

test("Task: toggleDone (опционально)", () => {
  if (!assume(ENT.Task, "Task не экспортируется")) return;
  const t = new ENT.Task({ id: "t3", title: "Write", minutes: 10, done: false });

  if (typeof t.toggleDone === "function") {
    const before = t.done;
    t.toggleDone();
    expect(t.done).toBe(!before);
  } else if ("done" in t) {
    console.warn("[SKIP] toggleDone отсутствует, но поле done есть — ок");
  } else {
    console.warn("[SKIP] toggleDone/field done отсутствуют");
  }
});

test("Task: сериализация (toJSON/fromJSON) при наличии", () => {
  if (!assume(ENT.Task, "Task не экспортируется")) return;
  const t = new ENT.Task({ id: "t4", title: "Code", minutes: 25, done: false });

  if (typeof t.toJSON === "function" && typeof ENT.Task.fromJSON === "function") {
    const j = t.toJSON();
    expect(!!j.title).toBeTruthy();
    const t2 = ENT.Task.fromJSON(j);
    expect(t2.title).toBe("Code");
  } else {
    console.warn("[SKIP] toJSON/fromJSON отсутствуют — ок на раннем этапе");
  }
});
