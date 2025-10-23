"use strict";
import { overrideRepo as local } from "../local/override.repo.local.js";
import { overrideRepoCloud as cloud } from "../cloud/override.repo.cloud.js";

/**
 * SmartRepo — объединяет local+cloud. Пока заглушка.
 */
export const overrideRepoSmart = {
  async load(dateKey) { return local.load(dateKey); },
  async save(dateKey, override) {
    await local.save(dateKey, override);
    // TODO: sync с облаком + LWW
  },
  async listAll(){ return local.listAll(); }
};
