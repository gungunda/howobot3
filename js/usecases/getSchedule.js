"use strict";
import { scheduleRepo } from "../app.js";
export async function getSchedule() { return scheduleRepo.load(); }
