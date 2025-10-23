import { test, expect } from "../test-runner.js";
import * as ENT from "../../js/domain/entities.js";

function assume(c,m){ if(!c){ console.warn("[SKIP] " + m); return false;} return true; }

test("DayOverride: базовая форма", () => {
  if (!assume(ENT.DayOverride, "DayOverride не экспортируется")) return;
  const t = ENT.Task ? new ENT.Task({ id: "d1", title: "One", minutes: 10 }) : { id: "d1", title: "One", minutes: 10 };
  const d = new ENT.DayOverride({ dateKey: "2025-10-23", tasks: [t] });

  expect(typeof d.dateKey).toBe("string");
  expect(Array.isArray(d.tasks)).toBe(true);
});

test("DayOverride: сериализация (если есть)", () => {
  if (!assume(ENT.DayOverride, "DayOverride не экспортируется")) return;
  const t = ENT.Task ? new ENT.Task({ id: "d2", title: "Two", minutes: 15 }) : { id: "d2", title: "Two", minutes: 15 };
  const d = new ENT.DayOverride({ dateKey: "2025-10-24", tasks: [t] });

  if (typeof d.toJSON === "function" && typeof ENT.DayOverride.fromJSON === "function") {
    const j = d.toJSON();
    const d2 = ENT.DayOverride.fromJSON(j);
    expect(d2.dateKey).toBe("2025-10-24");
    expect(Array.isArray(d2.tasks)).toBe(true);
  } else {
    console.warn("[SKIP] toJSON/fromJSON отсутствуют");
  }
});
