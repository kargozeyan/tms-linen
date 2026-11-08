import type {DB} from '../../db/connection';
import {recalculateLinen} from '../linen/linen.service';
import {findOpenMainCleaningTasks} from './task.repository';

export async function recalculateOpenMainCleaningTasks(db: DB, reservationId: string, eventId: string, reason: string) {
  const tasks = await findOpenMainCleaningTasks(db, reservationId);
  for (const task of tasks) {
    await recalculateLinen(db, task, eventId, reason);
  }
}
