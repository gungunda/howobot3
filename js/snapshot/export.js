// js/snapshot/export.js
// Цель модуля snapshot:
// 1. Собрать текущее локальное состояние планировщика в один объект.
//    Это удобно отправлять в облако (Telegram).
// 2. Принять состояние из облака и разложить его назад в локальное хранилище,
//    сравнивая по метаданным (updatedAt).
//
// Это важный шаг к синхронизации между устройствами.
// Уровень junior: думай об этом как о "сделать резервную копию" и "восстановиться из копии".

import * as localOverrideRepo from "../adapters/local/override.repo.local.js";
import * as localScheduleRepo from "../adapters/local/schedule.repo.local.js";
import { DeviceId } from "../domain/id.js";

/**
 * Читает ВСЁ локальное состояние и возвращает snapshot.
 * Этот snapshot можно:
 *   - показать пользователю как debug
 *   - отправить в Telegram как "облачную версию"
 *
 * Формат snapshot:
 * {
 *   version: "1.0",
 *   deviceId: "...",
 *   exportedAt: "...ISO...",
 *
 *   schedule: { monday: [...], ..., sunday: [...] },
 *
 *   overridesByDate: {
 *     "2025-10-26": {
 *        dateKey: "2025-10-26",
 *        tasks: [ { id, title, minutes, donePercent, done, meta }, ... ],
 *        meta: { ... }
 *     },
 *     ...
 *   }
 * }
 */
export async function exportSnapshot() {
  // 1. Берём недельное расписание
  const schedule = await localScheduleRepo.loadSchedule();

  // 2. Берём все override-дни
  const allDates = await localOverrideRepo.listOverrides(); // массив строк дат
  const overridesByDate = {};

  for (const dateKey of allDates) {
    const ov = await localOverrideRepo.loadOverride(dateKey);
    if (ov && ov.dateKey) {
      overridesByDate[ov.dateKey] = ov;
    }
  }

  return {
    version: "1.0",
    deviceId: getDeviceId(),
    exportedAt: new Date().toISOString(),
    schedule,
    overridesByDate
  };
}

/**
 * Вспомогательная функция: сравнение "кто свежее".
 * Возвращает true, если cand выигрывает у base.
 *
 * Стратегия Last-Write-Wins:
 * - если у одного из объектов нет meta или meta.updatedAt → он слабее
 * - если у обоих есть updatedAt → побеждает тот, у кого updatedAt больше (позже по времени)
 */
function isNewer(candMeta, baseMeta) {
  const candTime = candMeta?.updatedAt;
  const baseTime = baseMeta?.updatedAt;
  if (!candTime && !baseTime) return false;
  if (candTime && !baseTime) return true;
  if (!candTime && baseTime) return false;
  // оба есть → сравнить строки ISO по алфавиту (для ISO это норм)
  return candTime > baseTime;
}

/**
 * Слить (мерджнуть) две версии одной задачи (один и тот же taskId),
 * выбрав ту, у которой meta.updatedAt свежее.
 *
 * localTask  — версия в локальном хранилище
 * cloudTask  — версия из snapshot-а
 *
 * Возвращает финальную задачу.
 */
function mergeTaskLWW(localTask, cloudTask) {
  if (!localTask) return cloudTask;
  if (!cloudTask) return localTask;

  // Если id разные, это вообще не та же сущность. Безопасный путь — не смешивать.
  if (String(localTask.id || "") !== String(cloudTask.id || "")) {
    return localTask;
  }

  const pickCloud = isNewer(cloudTask.meta, localTask.meta);
  return pickCloud ? cloudTask : localTask;
}

/**
 * Мердж расписания недели.
 * Идём по всем дням недели и по всем задачам внутри дня.
 * Совпадение задач — по task.id.
 */
function mergeScheduleLWW(localSchedule, cloudSchedule) {
  const weekdays = [
    "monday","tuesday","wednesday",
    "thursday","friday","saturday","sunday"
  ];

  const result = {};

  for (const wd of weekdays) {
    const localArr = Array.isArray(localSchedule[wd]) ? localSchedule[wd] : [];
    const cloudArr = Array.isArray(cloudSchedule[wd]) ? cloudSchedule[wd] : [];

    // строим карту по task.id
    const byId = new Map();

    for (const t of localArr) {
      byId.set(String(t.id || ""), { local: t, cloud: null });
    }
    for (const t of cloudArr) {
      const key = String(t.id || "");
      if (!byId.has(key)) {
        byId.set(key, { local: null, cloud: t });
      } else {
        const pair = byId.get(key);
        pair.cloud = t;
        byId.set(key, pair);
      }
    }

    // теперь решаем по каждой задаче, кто победил
    result[wd] = [];
    for (const [_, pair] of byId.entries()) {
      const merged = mergeTaskLWW(pair.local, pair.cloud);
      if (merged) {
        result[wd].push(merged);
      }
    }
  }

  return result;
}

/**
 * Мердж одного override-дня (по dateKey)
 * LWW на уровне:
 * - всего дня (ov.meta.updatedAt)
 * - и задач внутри (тут можно в будущем усложнить,
 *   но на первом шаге мы ориентируемся на целый день как единицу)
 *
 * Сейчас упрощённо:
 * Если у snapshot-версии день свежее по ov.meta.updatedAt,
 * мы берём день из snapshot целиком.
 * Иначе оставляем локальную версию дня.
 *
 * Это честный и понятный для junior подход.
 */
function mergeOverrideDayLWW(localOv, cloudOv) {
  if (!localOv) return cloudOv;
  if (!cloudOv) return localOv;

  const pickCloud = isNewer(cloudOv.meta, localOv.meta);
  return pickCloud ? cloudOv : localOv;
}

/**
 * importSnapshot(snapshot):
 * - берёт снапшот из облака,
 * - склеивает с локальными данными по принципу "чья версия свежее",
 * - результат сохраняет в локальное хранилище.
 *
 * ПОКА ЧТО:
 * - мы работаем с локальными репозиториями напрямую
 *   (schedule.repo.local.js и override.repo.local.js),
 *   а не через smart.*.repo.
 *
 * ПОЧЕМУ:
 * - smart.saveOverride() и smart.saveSchedule() сейчас всегда мутируют meta
 *   (touch meta перед сохранением),
 *   а нам тут нужно сохранить именно ту версию, которая победила,
 *   не перетрогав updatedAt.
 *   То есть мы импортируем как "авторитетную правду".
 */
export async function importSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return { ok: false, reason: "no-snapshot" };
  }

  // 1. Мердж расписания недели
  const localSchedule = await localScheduleRepo.loadSchedule();
  const cloudSchedule = snapshot.schedule || {};
  const finalSchedule = mergeScheduleLWW(localSchedule, cloudSchedule);

  // 2. Мердж override-дней
  //    Собираем список всех дат: локальных + облачных
  const localDates = await localOverrideRepo.listOverrides(); // ["2025-10-26", ...]
  const cloudDates = Object.keys(snapshot.overridesByDate || {}); // те, что пришли в снапшоте
  const allDatesSet = new Set([ ...localDates, ...cloudDates ]);

  const finalOverrides = {};

  for (const dateKey of allDatesSet) {
    const localOv  = await localOverrideRepo.loadOverride(dateKey);
    const cloudOv  = snapshot.overridesByDate?.[dateKey] || null;

    const mergedOv = mergeOverrideDayLWW(localOv, cloudOv);
    if (mergedOv && mergedOv.dateKey) {
      finalOverrides[mergedOv.dateKey] = mergedOv;
    }
  }

  // 3. Записываем результат локально.
  //
  // saveSchedule() в localScheduleRepo перезапишет весь weekly schedule.
  // Но ВНИМАНИЕ: localScheduleRepo.saveSchedule()
  // не добавляет meta сам по себе (в этом модуле нет штамповки).
  // Это нам подходит — мы не хотим заново трогать updatedAt.
  //
  await localScheduleRepo.saveSchedule(finalSchedule);

  // а вот overrides надо сохранить поштучно
  for (const [dateKey, ov] of Object.entries(finalOverrides)) {
    await localOverrideRepo.saveOverride(ov);
  }

  return { ok: true };
}
