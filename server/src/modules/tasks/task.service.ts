import type {DB} from '../../db/connection';
import {withPoolTransaction} from '../../db/transaction';
import {HttpError} from '../../shared/errors';
import {recalculateLinen} from '../linen/linen.service';
import {findOpenMainCleaningTasks, findTask, insertTask, updateTask} from './task.repository';
import {OPEN_TASK_STATUSES, type Task, type TaskChanges} from './task.schemas';

const RECALCULATION_TRIGGER_FIELDS = ['task_type', 'listing_id', 'reservation_id', 'planned_start'] as const;

export async function createTask(task: Task) {
  return withPoolTransaction(async (db) => {
    if (await findTask(db, task.task_id)) {
      throw new HttpError(409, `Task ${task.task_id} already exists`);
    }

    await insertTask(db, task);
    await recalculateLinen(db, task, null, 'Task created');

    return task;
  });
}

export async function patchTask(taskId: string, changes: TaskChanges) {
  return withPoolTransaction(async (db) => {
    const before = await findTask(db, taskId);
    if (!before) {
      throw new HttpError(404, `Task ${taskId} not found`);
    }

    const after = {...before, ...changes};
    await updateTask(db, after);

    const changedFields = findChangedTriggerFields(before, after);
    if (changedFields.length > 0 && OPEN_TASK_STATUSES.includes(after.status)) {
      await recalculateLinen(db, after, null, `Task updated: ${changedFields.join(', ')}`);
    }

    return after;
  });
}

export async function recalculateOpenMainCleaningTasks(db: DB, reservationId: string, eventId: string, reason: string) {
  const tasks = await findOpenMainCleaningTasks(db, reservationId);
  for (const task of tasks) {
    await recalculateLinen(db, task, eventId, reason);
  }
}

function findChangedTriggerFields(before: Task, after: Task) {
  return RECALCULATION_TRIGGER_FIELDS.filter((field) =>
    field === 'planned_start'
      ? before.planned_start.getTime() !== after.planned_start.getTime()
      : before[field] !== after[field],
  );
}
