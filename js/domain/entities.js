//
// js/domain/entities.js
//
// Domain layer (чистая бизнес-логика приложения).
// Здесь нет ни DOM, ни Telegram API, ни Storage.
// Здесь описаны три сущности предметной области:
//
// - Task        = отдельная учебная задача (домашка)
// - DayOverride = конкретный день календаря с прогрессом
// - Schedule    = недельное расписание (шаблон)
//
// Плюс есть функции для работы с датами.
//

// =======================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДАТ
// =======================================================

/**
 * toDateKey(Date) -> "YYYY-MM-DD"
 */
export function toDateKey(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * addDaysToDateKey("2025-10-27", 1) -> "2025-10-28"
 */
export function addDaysToDateKey(dateKey, n) {
  const [y, m, d] = String(dateKey).split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  dt.setDate(dt.getDate() + Number(n || 0));
  return toDateKey(dt);
}

/**
 * weekdayKeyFromDateKey("2025-10-27") -> "monday"
 *
 * Это нужно, потому что расписание у нас хранится по ключам:
 * monday, tuesday, ... sunday
 */
export function weekdayKeyFromDateKey(dateKey) {
  const [y, m, d] = String(dateKey).split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  const map = [
    "sunday",    // 0
    "monday",    // 1
    "tuesday",   // 2
    "wednesday", // 3
    "thursday",  // 4
    "friday",    // 5
    "saturday"   // 6
  ];
  return map[dt.getDay()] || "monday";
}

/**
 * clampPercent(137) -> 100
 * clampPercent(-50) -> 0
 * clampPercent(42)  -> 42
 */
export function clampPercent(x) {
  let v = Math.round(Number(x) || 0);
  if (v < 0) v = 0;
  if (v > 100) v = 100;
  return v;
}


// =======================================================
// КЛАСС Task
// =======================================================
//
// Task описывает одно задание.
// Оно может жить:
//  - в расписании недели (Schedule)
//  - в конкретном дне (DayOverride)
//
// В расписании важны: title, minutes, offloadDays.
// В дне важны: donePercent, done.
// В override мы не храним offloadDays.
//

export class Task {
  /**
   * Конструктор.
   *
   * id           - строка. Если не передана, мы сгенерируем.
   * title        - название задания
   * minutes      - длительность в минутах
   * donePercent  - прогресс 0..100
   * done         - true если выполнено
   * offloadDays  - массив дней недели, куда можно "разгружать" заранее
   * meta         - служебка
   */
  constructor({
    id,
    title,
    minutes,
    donePercent = 0,
    done = false,
    offloadDays = [],
    meta = null
  }) {
    this.id = String(
      id ||
      ("task_" +
        Date.now().toString(36) +
        "_" +
        Math.floor(Math.random() * 1e6))
    );

    this.title = String(title || "Без названия");

    this.minutes = Math.max(0, Number(minutes) || 0);

    const pct = clampPercent(donePercent);
    this.donePercent = pct;
    this.done = pct >= 100 || !!done;

    this.offloadDays = Array.isArray(offloadDays)
      ? [...offloadDays]
      : [];

    this.meta = meta || null;
  }

  /**
   * Удобный геттер: задача считается сделанной, если 100%.
   */
  isDone() {
    return this.donePercent >= 100;
  }

  /**
   * Вернуть НОВУЮ задачу с обновлённым процентом выполнения.
   * Исходный объект не мутируем.
   */
  withProgressPercent(newPercent) {
    const pct = clampPercent(newPercent);
    return new Task({
      ...this,
      donePercent: pct,
      done: pct >= 100
    });
  }

  /**
   * Вернуть НОВУЮ задачу с обновлёнными текстовыми полями
   * (title, minutes). Используется для inline-редактирования.
   */
  withInlinePatch(patch) {
    return new Task({
      ...this,
      title:
        patch.title !== undefined
          ? (String(patch.title || "").trim() ||
              "Без названия")
          : this.title,
      minutes:
        patch.minutes !== undefined
          ? Math.max(0, Number(patch.minutes) || 0)
          : this.minutes
    });
  }

  /**
   * Подготовка к сохранению в Storage:
   * превращаем в обычный объект без методов.
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      minutes: this.minutes,
      donePercent: this.donePercent,
      done: this.done,
      offloadDays: this.offloadDays.slice(),
      meta: this.meta
    };
  }

  /**
   * Восстановление Task из plain-объекта (например после load из repo).
   */
  static fromJSON(raw) {
    if (!raw || typeof raw !== "object") {
      return new Task({});
    }
    return new Task({
      id: raw.id,
      title: raw.title,
      minutes: raw.minutes,
      donePercent: raw.donePercent,
      done: raw.done,
      offloadDays: raw.offloadDays,
      meta: raw.meta
    });
  }

  /**
   * Создать задачу для Override (конкретного дня)
   * на основе задачи из расписания.
   * Прогресс всегда сбрасывается в 0.
   */
  static fromScheduleTask(scheduleTask) {
    return new Task({
      id: scheduleTask.id,
      title: scheduleTask.title,
      minutes: scheduleTask.minutes,
      donePercent: 0,
      done: false,
      offloadDays: [], // в override разгрузка не важна
      meta: scheduleTask.meta || null
    });
  }
}


// =======================================================
// КЛАСС DayOverride
// =======================================================
//
// DayOverride = снимок конкретного календарного дня
// (например "2025-10-27").
//
// Тут мы храним только задачи на этот день и их прогресс,
// плюс мету (когда обновлялось, какое действие делали).
//

export class DayOverride {
  constructor({ dateKey, tasks, meta }) {
    this.dateKey = String(dateKey);

    // Гарантируем, что tasks — это массив Task
    this.tasks = Array.isArray(tasks)
      ? tasks.map(t => (t instanceof Task ? t : Task.fromJSON(t)))
      : [];

    this.meta = {
      createdAt: meta?.createdAt || new Date().toISOString(),
      updatedAt: meta?.updatedAt || new Date().toISOString(),
      userAction: meta?.userAction || "init",
      deviceId: meta?.deviceId || null
    };
  }

  /**
   * Обновить тех.инфу о том, что DayOverride менялся.
   */
  touch(userAction) {
    this.meta = {
      ...this.meta,
      updatedAt: new Date().toISOString(),
      userAction: userAction || this.meta.userAction || "update"
    };
  }

  /**
   * Найти задачу по id.
   */
  getTask(taskId) {
    return this.tasks.find(
      t => String(t.id) === String(taskId)
    );
  }

  /**
   * Убедиться, что задача с таким id есть в этом дне.
   * Если нет — попробуем подтянуть её из расписания.
   * Если даже в расписании нет — создадим заглушку.
   */
  ensureTask(taskId, scheduleInstance) {
    let task = this.getTask(taskId);
    if (task) return task;

    if (scheduleInstance instanceof Schedule) {
      const schedTask = scheduleInstance.findTaskAnywhere(
        taskId
      );
      if (schedTask) {
        const newTask = Task.fromScheduleTask(schedTask);
        this.tasks = [...this.tasks, newTask];
        this.touch("ensureTask");
        return newTask;
      }
    }

    const fallback = new Task({
      id: taskId,
      title: "Задача",
      minutes: 0,
      donePercent: 0,
      done: false,
      offloadDays: [],
      meta: null
    });
    this.tasks = [...this.tasks, fallback];
    this.touch("ensureTask:fallback");
    return fallback;
  }

  /**
   * Изменить прогресс задачи на delta (обычно +10 или -10).
   */
  bumpTaskPercent(taskId, delta) {
    const current = this.getTask(taskId);
    if (!current) return;

    const newPct = clampPercent(
      (current.donePercent || 0) + (delta || 0)
    );
    const updatedTask =
      current.withProgressPercent(newPct);

    this.tasks = this.tasks.map(t =>
      String(t.id) === String(taskId) ? updatedTask : t
    );

    this.touch("bumpTaskPercent");
    return updatedTask;
  }

  /**
   * Переключить чекбокс "сделано":
   * если было <100%, делаем 100;
   * если было 100, делаем 0.
   */
  toggleTaskDone(taskId) {
    const current = this.getTask(taskId);
    if (!current) return;

    const newPct = current.isDone() ? 0 : 100;
    const updatedTask =
      current.withProgressPercent(newPct);

    this.tasks = this.tasks.map(t =>
      String(t.id) === String(taskId) ? updatedTask : t
    );

    this.touch("toggleTaskDone");
    return updatedTask;
  }

  /**
   * Inline-редактирование задачи именно в этом дне:
   * поменять title и/или minutes.
   */
  editTaskInline(taskId, patch) {
    const current = this.getTask(taskId);
    if (!current) return;

    const updatedTask = current.withInlinePatch(patch);

    this.tasks = this.tasks.map(t =>
      String(t.id) === String(taskId) ? updatedTask : t
    );

    this.touch("editTaskInline");
    return updatedTask;
  }

  /**
   * Превратить DayOverride в plain-объект для сохранения.
   */
  toJSON() {
    return {
      dateKey: this.dateKey,
      tasks: this.tasks.map(t => t.toJSON()),
      meta: { ...this.meta }
    };
  }

  /**
   * Восстановить DayOverride из plain-объекта
   * (например то, что прочитали из repo.loadDayOverride()).
   */
  static fromJSON(raw) {
    if (!raw || typeof raw !== "object") {
      return new DayOverride({
        dateKey: "1970-01-01",
        tasks: [],
        meta: {}
      });
    }
    return new DayOverride({
      dateKey: raw.dateKey,
      tasks: Array.isArray(raw.tasks)
        ? raw.tasks.map(t => Task.fromJSON(t))
        : [],
      meta: raw.meta || {}
    });
  }

  /**
   * Создать новый DayOverride "с нуля" на эту дату
   * по расписанию ("домашка на завтра").
   */
  static createFromSchedule(dateKey, scheduleTasksForTomorrow) {
    const tasks = Array.isArray(scheduleTasksForTomorrow)
      ? scheduleTasksForTomorrow.map(t =>
          Task.fromScheduleTask(t)
        )
      : [];

    return new DayOverride({
      dateKey,
      tasks,
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userAction: "createFromSchedule",
        deviceId: null
      }
    });
  }
}


// =======================================================
// КЛАСС Schedule
// =======================================================
//
// Schedule = расписание недели.
// Пример внутреннего вида:
// {
//   monday:    [Task, Task, ...],
//   tuesday:   [...],
//   ...
//   sunday:    [...]
// }
//
// Это шаблон: "в среду задают математику на 30 минут,
// можно разгружать на вторник".
// Здесь НЕТ прогресса выполнения за конкретный день.
//
// Из Schedule мы умеем собрать DayOverride для конкретного dateKey.
//

export class Schedule {
  constructor(weekMap) {
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday"
    ];

    this.week = {};
    for (const d of days) {
      const arr = Array.isArray(weekMap?.[d])
        ? weekMap[d]
        : [];
      this.week[d] = arr.map(t =>
        t instanceof Task ? t : Task.fromJSON(t)
      );
    }
  }

  /**
   * Добавить новую задачу в указанный день недели.
   * Возвращает НОВЫЙ Schedule (старый не мутируется).
   *
   * weekdayKey: "monday" / "tuesday" / ...
   * taskData: {
   *   title: string,
   *   minutes: number,
   *   offloadDays: string[]
   * }
   */
  withNewTask(weekdayKey, taskData) {
    const newTask = new Task({
      id: taskData?.id, // можно не указывать, Task сам сгенерит
      title: taskData?.title ?? "Без названия",
      minutes:
        taskData?.minutes !== undefined
          ? Number(taskData.minutes) || 0
          : 0,
      offloadDays: Array.isArray(taskData?.offloadDays)
        ? [...taskData.offloadDays]
        : [],
      donePercent: 0,
      done: false,
      meta: taskData?.meta || null
    });

    const clone = new Schedule(this.toJSON());

    const prevList = Array.isArray(clone.week[weekdayKey])
      ? clone.week[weekdayKey]
      : [];

    clone.week[weekdayKey] = [...prevList, newTask];

    return clone;
  }

  /**
   * Изменить существующую задачу в расписании:
   * - title
   * - minutes
   * - offloadDays
   *
   * Возвращает НОВЫЙ Schedule.
   */
  withEditedTask(weekdayKey, taskId, patch) {
    const clone = new Schedule(this.toJSON());

    clone.week[weekdayKey] = (clone.week[weekdayKey] || []).map(
      task => {
        if (String(task.id) !== String(taskId)) {
          return task;
        }

        // сначала обновляем title/minutes через withInlinePatch
        let updated = task.withInlinePatch({
          title: patch?.title,
          minutes: patch?.minutes
        });

        // потом при необходимости обновляем offloadDays
        if (patch?.offloadDays !== undefined) {
          updated = new Task({
            ...updated,
            offloadDays: Array.isArray(patch.offloadDays)
              ? [...patch.offloadDays]
              : []
          });
        }

        return updated;
      }
    );

    return clone;
  }

  /**
   * Удалить задачу из расписания дня weekdayKey.
   * Возвращает НОВЫЙ Schedule.
   */
  withTaskRemoved(weekdayKey, taskId) {
    const clone = new Schedule(this.toJSON());

    clone.week[weekdayKey] = (clone.week[weekdayKey] || []).filter(
      t => String(t.id) !== String(taskId)
    );

    return clone;
  }

  /**
   * Найти задачу по id в ЛЮБОЙ день недели.
   * Это нужно DayOverride.ensureTask(...), чтобы,
   * если в override нет задачи, мы могли подтянуть её из расписания.
   */
  findTaskAnywhere(taskId) {
    for (const weekdayKey of Object.keys(this.week)) {
      const arr = this.week[weekdayKey] || [];
      for (const task of arr) {
        if (String(task.id) === String(taskId)) {
          return task;
        }
      }
    }
    return null;
  }

  /**
   * Вернуть массив задач, которые должны лечь в override
   * для dateKey.
   *
   * Правило нашего приложения:
   *   "домашка делается на завтра".
   *
   * То есть если сегодня понедельник (2025-10-27),
   * мы берём расписание вторника.
   */
  tasksForOverrideDate(dateKey) {
    const tomorrowKey = addDaysToDateKey(dateKey, 1);
    const wdTomorrow = weekdayKeyFromDateKey(tomorrowKey);
    return this.week[wdTomorrow] || [];
  }

  /**
   * На основе расписания недели построить DayOverride
   * (снимок на конкретную дату).
   */
  makeOverrideForDate(dateKey) {
    const tomorrowTasks = this.tasksForOverrideDate(dateKey);
    return DayOverride.createFromSchedule(
      dateKey,
      tomorrowTasks
    );
  }

  /**
   * Сериализация расписания для сохранения в Storage.
   */
  toJSON() {
    const out = {};
    for (const dayKey of Object.keys(this.week)) {
      out[dayKey] = (this.week[dayKey] || []).map(t =>
        t.toJSON()
      );
    }
    return out;
  }

  /**
   * Восстановление расписания после repo.loadSchedule().
   */
  static fromJSON(raw) {
    return new Schedule(raw || {});
  }
}