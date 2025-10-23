"use strict";
import { scheduleRepo as local } from "../local/schedule.repo.local.js";
import { scheduleRepoCloud as cloud } from "../cloud/schedule.repo.cloud.js";

/**
 * SmartRepo — объединяет local+cloud. Пока заглушка:
 * возвращает локальные данные, а при сохранении — только локально.
 */
export const scheduleRepoSmart = {
  async load() { return local.load(); },
  async save(schedule) {
    await local.save(schedule);
    // TODO: sync с облаком + LWW
  }
};
