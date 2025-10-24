// js/ui/events.js
// Управление состоянием UI, навигация и обработка кликов.
// Здесь важная логика разгрузки:
// прогресс по разгрузке пишем не в "сегодня" и не в сам основной день,
// а в "дедлайн-день" = предыдущий день недели перед основным днём задачи.

import { updateDashboardView } from "./view-dashboard.js";
import { updateWeekView } from "./view-week.js";
import { updateCalendarView } from "./view-calendar.js";
import { todayKey } from "./helpers.js";

// ==== date utils ===========================================================

// dateKey -> Date
function dateFromKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

// Date -> "YYYY-MM-DD"
function keyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// addDaysToDateKey("2025-10-24", 1) -> "2025-10-25"
function addDaysToDateKey(dateKey, n) {
  const d = dateFromKey(dateKey);
  d.setDate(d.getDate() + Number(n || 0));
  return keyFromDate(d);
}

// weekdayKeyFromDateKey("2025-10-24") -> "friday"
// getDay(): 0..6 = Sun..Sat
function weekdayKeyFromDateKey(dateKey) {
  const d = dateFromKey(dateKey);
  const map = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
  ];
  return map[d.getDay()] || "monday";
}

// prevWeekdayKey("sunday") -> "saturday"
// prevWeekdayKey("monday") -> "sunday"
// Это "дедлайн-день": когда работа должна быть уже сделана.
function prevWeekdayKey(dayKey) {
  const prevMap = {
    monday: "sunday",
    tuesday: "monday",
    wednesday: "tuesday",
    thursday: "wednesday",
    friday: "thursday",
    saturday: "friday",
    sunday: "saturday"
  };
  return prevMap[dayKey] || "saturday";
}

// Найти ближайшую дату вперёд (включая fromDateKey),
// у которой день недели == targetWeekday.
function nextDateKeyForWeekday(fromDateKey, targetWeekday) {
  for (let step = 0; step < 7; step++) {
    const probeKey = addDaysToDateKey(fromDateKey, step);
    if (weekdayKeyFromDateKey(probeKey) === targetWeekday) {
      return probeKey;
    }
  }
  return fromDateKey; // fallback
}

// ==== stats helper =========================================================
// Возвращает { totalMinutes, doneMinutes, doneAvg }.

async function statsFor(tasks) {
  // пробуем готовый use case computeDayStats, если он есть
  try {
    const m = await import("../usecases/computeDayStats.js");
    const fn = m.default || m.computeDayStats || m.run;
    if (typeof fn === "function") {
      const r = await fn({ tasks });
      if (r) return r;
    }
  } catch (e) {
    // если нет - считаем вручную
  }

  let totalMinutes = 0;
  let doneMinutes = 0;
  let sumPct = 0;
  let n = 0;

  for (const t of tasks || []) {
    const mins = Number(t.minutes) || 0;
    const pct = Math.max(
      0,
      Math.min(100, Number(t.donePercent) || 0)
    );
    totalMinutes += mins;
    doneMinutes += (mins * pct) / 100;
    sumPct += pct;
    n++;
  }

  const doneAvg = n ? Math.round(sumPct / n) : 0;
  return { totalMinutes, doneMinutes, doneAvg };
}

// ==== task normalization ====================================================
// Приводим задачу к безопасной форме для UI.

function normalizeTaskForDay(t) {
  const pct = Math.max(
    0,
    Math.min(100, Math.round(Number(t?.donePercent || 0)))
  );

  let offloadDays = null;
  if (Array.isArray(t?.offloadDays)) {
    offloadDays = [...t.offloadDays];
  }

  return {
    id: String(t?.id || ""),
    title: String(t?.title || "Без названия"),
    minutes: Math.max(0, Number(t?.minutes) || 0),
    donePercent: pct,
    done: pct >= 100,
    offloadDays // массив строк или null
  };
}

// ==== view model builder ====================================================
// Готовим данные для дашборда за текущую дату dateKey.
// Возвращаем { coreTasks, offloadTasks }.
//
// coreTasks:
//   - задачи "на завтра" (D+1)
//   - прогресс по ним хранится в override(D), то есть в override сегодняшнего дня.
//
// offloadTasks:
//   - задачи, которые можно делать заранее ("разгрузка").
//   - каждая задача живёт в каком-то дне расписания mainWeekday (например "sunday").
//   - но реальный дедлайн — это предыдущий день недели (для "sunday" это "saturday").
//   - прогресс должен жить в override(ближайшая дата дедлайн-дня).
//
//   Пример:
//     Задача живёт в расписании "sunday".
//     prevWeekdayKey("sunday") = "saturday".
//     Если сегодня среда, берём "ближайшую субботу после среды".
//     Прогресс +10% записываем именно туда.

async function buildDayViewModel(dateKey) {
  const ovRepo = await import("../adapters/smart/smart.override.repo.js");
  const schRepo = await import("../adapters/smart/smart.schedule.repo.js");

  const loadOv = ovRepo.loadOverride || ovRepo.load;
  const loadS = schRepo.loadSchedule || schRepo.load;

  // Кэш override по дате
  const ovCache = {};
  async function getOverrideCached(dk) {
    if (!ovCache[dk]) {
      ovCache[dk] = await loadOv(dk);
    }
    return ovCache[dk];
  }

  const schedule = await loadS();

  const wdToday = weekdayKeyFromDateKey(dateKey); // напр. "wednesday"
  const tomorrowKey = addDaysToDateKey(dateKey, 1);
  const wdTomorrow = weekdayKeyFromDateKey(tomorrowKey); // напр. "thursday"

  // override(сегодня) хранит прогресс задач "на завтра"
  const ovToday = await getOverrideCached(dateKey);

  // --- CORE TASKS ("На завтра") ---
  let coreTasksRaw;
  if (ovToday && Array.isArray(ovToday.tasks) && ovToday.tasks.length) {
    // уже были изменения сегодня -> берём override сегодняшнего дня
    coreTasksRaw = ovToday.tasks.map(normalizeTaskForDay);
  } else {
    // нет override(сегодня) -> берём чистые задачи завтрашнего расписания
    const src = Array.isArray(schedule?.[wdTomorrow]) ? schedule[wdTomorrow] : [];
    coreTasksRaw = src.map(t => normalizeTaskForDay({
      ...t,
      donePercent: 0,
      done: false
    }));
  }

  const coreTasks = coreTasksRaw.map(t => ({
    ...t,
    mainWeekday: wdTomorrow, // задача относится к завтрашнему дню недели
    source: "core"
  }));

  // --- OFFLOAD TASKS ("Разгрузка") ---
  // Правило:
  //   - Берём все задачи расписания всех дней недели.
  //   - Если у задачи offloadDays включает сегодняшний день недели (wdToday),
  //     значит её можно делать заранее сегодня.
  //   - Эта задача "формально живёт" в weekdayKey (например, "sunday").
  //   - Но реальный дедлайн — это предыдущий weekday: prevWeekdayKey(weekdayKey).
  //   - Прогресс ищем в override ближайшей даты "дедлайн-дня".
  //
  //   То есть:
  //     mainWeekday = день недели в расписании, где задача живёт (например "sunday").
  //     deadlineWeekday = prevWeekdayKey(mainWeekday) (для sunday -> saturday).
  //     targetDateKey = ближайшая дата вперёд, у которой день недели = deadlineWeekday.
  //     override(targetDateKey) — источник / место хранения прогресса.

  const offloadTasks = [];

  for (const weekdayKey of Object.keys(schedule || {})) {
    const dayArr = Array.isArray(schedule[weekdayKey]) ? schedule[weekdayKey] : [];

    for (const task of dayArr) {
      const off = Array.isArray(task.offloadDays) ? task.offloadDays : [];
      if (!off.includes(wdToday)) {
        continue; // эту задачу не разгружаем сегодня
      }

      // не дублировать задачу, если она уже попала как core (на завтра)
      const alreadyCore = coreTasks.find(
        ct => ct.id === String(task.id || "")
      );
      if (alreadyCore) {
        continue;
      }

      // вычисляем дедлайн-день недели (день-1 от основного дня)
      const deadlineWeekday = prevWeekdayKey(weekdayKey);

      // находим ближайшую дату с днем недели = дедлайн-дню
      const targetDateKey = nextDateKeyForWeekday(dateKey, deadlineWeekday);

      // достаём override дедлайн-даты (а не основного дня!)
      const ovTarget = await getOverrideCached(targetDateKey);

      // ищем задачу по id в override дедлайн-даты
      let match = null;
      if (ovTarget && Array.isArray(ovTarget.tasks)) {
        match = ovTarget.tasks.find(
          x => String(x.id || "") === String(task.id || "")
        );
      }

      // если нашли — берём прогресс из override,
      // если нет — прогресс 0%
      let norm;
      if (match) {
        norm = normalizeTaskForDay(match);
      } else {
        norm = normalizeTaskForDay({
          ...task,
          donePercent: 0,
          done: false
        });
      }

      offloadTasks.push({
        ...norm,
        mainWeekday: weekdayKey, // в каком дне расписания эта задача живёт
        source: "offload"
      });
    }
  }

  return { coreTasks, offloadTasks };
}

// ==== refresh functions =====================================================

async function refreshDashboard(state) {
  const { coreTasks, offloadTasks } = await buildDayViewModel(state.currentDateKey);
  const allTasksForStats = [...coreTasks, ...offloadTasks];
  const st = await statsFor(allTasksForStats);

  updateDashboardView({
    dateKey: state.currentDateKey,
    tasks: coreTasks,
    offloadTasks,
    stats: st
  });
}

async function refreshScheduleEditor(state) {
  const m = await import("../usecases/getSchedule.js");
  const getSchedule = m.default || m.getSchedule;
  const schedule = await getSchedule();
  updateWeekView(schedule, state);
}

async function refreshCalendar(state) {
  updateCalendarView(state);
}

// ==== resolveTargetDateKeyForRow ===========================================
// Эта функция решает, В КАКОЙ override-день мы сохраняем прогресс
// по задаче, по которой юзер кликнул (+10%, чекбокс done и т.д.)

function resolveTargetDateKeyForRow(row, currentDateKey) {
  const source = row?.dataset?.source || "core";
  const mainWeekday = row?.dataset?.mainWeekday || "";

  if (source === "core") {
    // Задачи "На завтра":
    // прогресс по ним храним в override(сегодня).
    return currentDateKey;
  }

  if (source === "offload" && mainWeekday) {
    // Задачи "Разгрузка":
    // Не пишем прогресс в сегодняшний день.
    // И не пишем прямо в день расписания (mainWeekday).
    //
    // Вместо этого берём ДЕДЛАЙН-день = предыдущий день недели
    // относительно mainWeekday.
    //
    // Пример:
    //   mainWeekday = "sunday"
    //   deadlineWeekday = "saturday"
    //   => ищем ближайшую субботу вперёд от currentDateKey
    //   => прогресс накапливается там.
    const deadlineWeekday = prevWeekdayKey(mainWeekday);
    return nextDateKeyForWeekday(currentDateKey, deadlineWeekday);
  }

  // fallback
  return currentDateKey;
}

// ==== binders ==============================================================

// Обработчики для дашборда (экран "Сегодня")
function bindDashboard(state) {
  const root = document.querySelector('[data-view="dashboard"]');
  if (!root) return;

  root.addEventListener("click", async (e) => {
    const dashRoot = document.querySelector("[data-dashboard-root]");
    const dateKey = dashRoot?.dataset.dateKey || state.currentDateKey;

    // кнопка "Расписание"
    if (e.target.closest('[data-action="open-schedule-editor"]')) {
      await refreshScheduleEditor(state);
      showView("schedule");
      return;
    }

    // кнопка "Сбросить день"
    if (e.target.closest('[data-action="reset-day"]')) {
      const m = await import("../usecases/resetToSchedule.js");
      const fn = m.default || m.resetToSchedule;
      try {
        await fn({ dateKey });
      } catch (err) {}
      await refreshDashboard(state);
      return;
    }

    // -10% / +10%
    const minus = e.target.closest(".task-pct-minus");
    const plus = e.target.closest(".task-pct-plus");
    if (minus || plus) {
      const row = e.target.closest(".task-item");
      if (!row) return;
      const taskId = row.dataset.taskId;

      // ВАЖНО: теперь для offload задач уйдём не в currentDateKey, а в дедлайн-день
      const targetDateKey = resolveTargetDateKeyForRow(row, state.currentDateKey);

      const m = await import("../usecases/adjustTaskPercentForDate.js");
      const fn = m.default || m.adjustTaskPercentForDate;
      try {
        await fn({
          dateKey: targetDateKey,
          taskId,
          delta: plus ? +10 : -10
        });
      } catch (err) {}
      await refreshDashboard(state);
      return;
    }

    // ✎ редактирование названия задачи
    const editBtn = e.target.closest(".task-edit");
    if (editBtn) {
      const row = editBtn.closest(".task-item");
      if (!row) return;
      const taskId = row.dataset.taskId;
      const titleSpan = row.querySelector(".task-title");
      const oldTitle = titleSpan ? titleSpan.textContent.trim() : "";

      const newTitle = window.prompt("Название задачи", oldTitle);
      if (newTitle != null) {
        const targetDateKey = resolveTargetDateKeyForRow(row, state.currentDateKey);

        const m = await import("../usecases/editTaskInline.js");
        const fn = m.default || m.editTaskInline;
        try {
          await fn({
            dateKey: targetDateKey,
            taskId,
            patch: { title: newTitle }
          });
        } catch (err) {}
        await refreshDashboard(state);
      }
      return;
    }
  });

  // чекбокс done
  root.addEventListener("change", async (e) => {
    const cb = e.target.closest(".task-done");
    if (!cb) return;

    const row = cb.closest(".task-item");
    if (!row) return;
    const taskId = row.dataset.taskId;

    // опять же, вычисляем дедлайн-день, если это offload
    const targetDateKey = resolveTargetDateKeyForRow(row, state.currentDateKey);

    const m = await import("../usecases/toggleTaskDoneForDate.js");
    const fn = m.default || m.toggleTaskDoneForDate;
    try {
      await fn({ dateKey: targetDateKey, taskId });
    } catch (err) {}

    await refreshDashboard(state);
  });
}

// Обработчики для расписания недели (экран "Расписание")
function bindSchedule(state) {
  const view = document.querySelector('[data-view="schedule"]');
  if (!view) return;

  view.addEventListener("click", async (e) => {
    // Назад
    if (e.target.closest('[data-action="back-to-dashboard"]')) {
      await refreshDashboard(state);
      showView("dashboard");
      return;
    }

    // "+" добавить задачу
    const addBtn = e.target.closest(".week-add");
    if (addBtn) {
      const dayCard = e.target.closest(".week-day");
      const weekday = dayCard?.dataset.weekday;
      if (!weekday) return;

      const addMod = await import("../usecases/addTaskToSchedule.js");
      const addUC = addMod.default || addMod.addTaskToSchedule;

      const title = window.prompt("Название задачи", "Новая задача") || "Новая задача";
      const minutes = Number(window.prompt("Минуты", "30") || "30");

      await addUC({
        weekday,
        task: {
          title,
          minutes,
          offloadDays: []
        }
      });

      await refreshScheduleEditor(state);
      return;
    }

    // ✎ редактировать задачу расписания
    const editBtn = e.target.closest(".week-edit");
    if (editBtn) {
      const dayCard = e.target.closest(".week-day");
      const weekday = dayCard?.dataset.weekday;
      const row = editBtn.closest(".task-item");
      const taskId = row?.dataset.taskId;
      if (!weekday || !taskId) return;

      state.scheduleEdit = { weekday, taskId };
      await refreshScheduleEditor(state);
      return;
    }

    // 🗑 удалить задачу из расписания
    const delBtn = e.target.closest(".week-del");
    if (delBtn) {
      const dayCard = e.target.closest(".week-day");
      const weekday = dayCard?.dataset.weekday;
      const row = delBtn.closest(".task-item");
      const taskId = row?.dataset.taskId;
      if (!weekday || !taskId) return;

      if (window.confirm("Удалить задачу из шаблона?")) {
        const delMod = await import("../usecases/deleteTaskFromSchedule.js");
        const delUC = delMod.default || delMod.deleteTaskFromSchedule;
        await delUC({ weekday, taskId });
      }

      await refreshScheduleEditor(state);
      return;
    }

    // "Сохранить" изменения задачи расписания
    const saveBtn = e.target.closest(".week-save");
    if (saveBtn) {
      const dayCard = e.target.closest(".week-day");
      const weekday = dayCard?.dataset.weekday;

      const row = saveBtn.closest(".task-item.editing");
      const taskId = row?.dataset.taskId;
      if (!weekday || !taskId || !row) return;

      const titleInp = row.querySelector(".week-edit-title");
      const minutesInp = row.querySelector(".week-edit-minutes");
      const chkNodes = row.querySelectorAll(".week-offload-chk");

      const newTitle = titleInp ? titleInp.value.trim() : "";
      const newMin = minutesInp ? Number(minutesInp.value || "0") : 0;

      const offloadDays = [];
      chkNodes.forEach(cb => {
        if (cb.checked && !cb.disabled) {
          offloadDays.push(cb.value);
        }
      });

      const editMod = await import("../usecases/editTaskInSchedule.js");
      const editUC = editMod.default || editMod.editTaskInSchedule;

      await editUC({
        weekday,
        taskId,
        patch: {
          title: newTitle,
          minutes: newMin,
          offloadDays
        }
      });

      state.scheduleEdit = null;
      await refreshScheduleEditor(state);
      return;
    }

    // "Отмена"
    const cancelBtn = e.target.closest(".week-cancel");
    if (cancelBtn) {
      state.scheduleEdit = null;
      await refreshScheduleEditor(state);
      return;
    }
  });
}

// Обработчики для календаря
function bindCalendar(state) {
  const view = document.querySelector('[data-view="calendar"]');
  if (!view) return;

  view.addEventListener("click", async (e) => {
    // Назад
    if (e.target.closest('[data-action="back-to-dashboard-2"]')) {
      await refreshDashboard(state);
      showView("dashboard");
      return;
    }

    // Листание месяцев
    const prevBtn = e.target.closest("[data-cal-prev]");
    const nextBtn = e.target.closest("[data-cal-next]");
    if (prevBtn || nextBtn) {
      if (prevBtn) {
        state.calMonth -= 1;
        if (state.calMonth < 0) {
          state.calMonth = 11;
          state.calYear -= 1;
        }
      }
      if (nextBtn) {
        state.calMonth += 1;
        if (state.calMonth > 11) {
          state.calMonth = 0;
          state.calYear += 1;
        }
      }
      await refreshCalendar(state);
      return;
    }

    // Клик по конкретному дню месяца
    const cell = e.target.closest(".cal-day[data-date-key]");
    if (cell) {
      const pickedKey = cell.getAttribute("data-date-key");
      if (pickedKey) {
        state.currentDateKey = pickedKey;

        const dateInput = document.querySelector("[data-date-input]");
        if (dateInput) {
          dateInput.value = state.currentDateKey;
        }

        await refreshDashboard(state);
        showView("dashboard");
      }
      return;
    }
  });
}

// Навигация шапки (дата, "сегодня", кнопки перехода)
function bindHeader(state) {
  const dateInput = document.querySelector("[data-date-input]");
  const todayBtn = document.querySelector('[data-action="today"]');
  const navDash = document.querySelector('[data-nav="dashboard"]');
  const navSched = document.querySelector('[data-nav="schedule"]');
  const navCal = document.querySelector('[data-nav="calendar"]');

  if (dateInput) {
    dateInput.value = state.currentDateKey;
    dateInput.addEventListener("change", async () => {
      state.currentDateKey = dateInput.value;
      await refreshDashboard(state);
      showView("dashboard");
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener("click", async () => {
      const tk = todayKey();
      state.currentDateKey = tk;

      const dObj = new Date(tk + "T00:00:00");
      state.calYear = dObj.getFullYear();
      state.calMonth = dObj.getMonth();

      if (dateInput) dateInput.value = state.currentDateKey;
      await refreshDashboard(state);
      showView("dashboard");
    });
  }

  if (navDash) {
    navDash.addEventListener("click", async () => {
      await refreshDashboard(state);
      showView("dashboard");
    });
  }

  if (navSched) {
    navSched.addEventListener("click", async () => {
      await refreshScheduleEditor(state);
      showView("schedule");
    });
  }

  if (navCal) {
    navCal.addEventListener("click", async () => {
      await refreshCalendar(state);
      showView("calendar");
    });
  }
}

// Показать нужную вкладку .view[data-view="..."]
function showView(name) {
  document.querySelectorAll(".view").forEach(v => {
    v.hidden = (v.dataset.view !== name);
  });
}

// Инициализация приложения
export async function initUI() {
  const tk = todayKey();
  const dObj = new Date(tk + "T00:00:00");

  const state = {
    currentDateKey: tk,
    calYear: dObj.getFullYear(),
    calMonth: dObj.getMonth(),
    scheduleEdit: null
  };

  bindHeader(state);
  bindDashboard(state);
  bindSchedule(state);
  bindCalendar(state);

  await refreshDashboard(state);
  await refreshScheduleEditor(state);
  await refreshCalendar(state);

  showView("dashboard");
}
