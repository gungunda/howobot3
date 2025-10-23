"use strict";
import { OverrideRepositoryPort } from "../../ports/override-repo.port.js";

/** Заглушка под Telegram CloudStorage. Реализация будет на этапе синхронизации. */
class CloudOverrideRepo extends OverrideRepositoryPort {
  async load(_dateKey){ return null; }
  async save(_dateKey, _override){ /* TODO: реализовать через Telegram CloudStorage */ }
  async listAll(){ return {}; }
}

export const overrideRepoCloud = new CloudOverrideRepo();
