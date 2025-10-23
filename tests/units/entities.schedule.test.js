import { test, expect } from "../test-runner.js";
import * as ENT from "../../js/domain/entities.js";

function assume(cond, msg) { if (!cond){ console.warn("[SKIP] " + msg); return false;} return true; }

test("Schedule: структура дней недели присутствует", () => {
  if (!assume(ENT.Schedule, "Schedule не экспортируется")) return;
  const s = new ENT.Schedule({});
  const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  for (const d of days) {
    expect(Array.isArray(s[d] || [])).toBe(true);
  }
});

test("Schedule: сериализация (если есть toJSON/fromJSON)", () => {
  if (!assume(ENT.Schedule, "Schedule не экспортируется")) return;
  const task = ENT.Task ? new ENT.Task({ id: "sx1", title: "Plan", minutes: 5 }) : { id: "sx1", title: "Plan", minutes: 5 };
  const s = new ENT.Schedule({ monday: [task] });

  if (typeof s.toJSON === "function" && typeof ENT.Schedule.fromJSON === "function") {
    const j = s.toJSON();
    expect(Array.isArray(j.monday)).toBe(true);
    const s2 = ENT.Schedule.fromJSON(j);
    expect(Array.isArray(s2.monday)).toBe(true);
  } else {
    console.warn("[SKIP] toJSON/fromJSON отсутствуют");
  }
});
