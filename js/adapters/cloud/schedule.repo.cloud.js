"use strict";
import { Schedule } from "../../domain/entities.js";
import { ScheduleRepositoryPort } from "../../ports/schedule-repo.port.js";

/** Заглушка под Telegram CloudStorage. Реализация будет на этапе синхронизации. */
class CloudScheduleRepo extends ScheduleRepositoryPort {
  async load(){ return new Schedule(); }
  async save(_schedule){ /* TODO: реализовать через Telegram CloudStorage */ }
}

export const scheduleRepoCloud = new CloudScheduleRepo();
