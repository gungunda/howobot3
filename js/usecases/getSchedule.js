// js/usecases/getSchedule.js
import { loadSchedule } from "../data/repo.js";
export async function getSchedule() {
  return loadSchedule();
}
export default getSchedule;
