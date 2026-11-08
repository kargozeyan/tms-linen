import type {DB} from '../../db/connection';
import {pool} from '../../db/pool';
import {withPoolTransaction} from '../../db/transaction';
import {HttpError} from '../../shared/errors';
import {findLinenHistory} from '../linen/linen.repository';
import {recalculateLinen} from '../linen/linen.service';
import {
  findAllTasksWithLinen,
  findOpenMainCleaningTasks,
  findTask,
  findTaskWithLinen,
  insertTask,
  updateTask,
} from './task.repository';
import {OPEN_TASK_STATUSES, type Task, type TaskChanges} from './task.schemas';

const RECALCULATION_TRIGGER_FIELDS = ['task_type', 'listing_id', 'reservation_id', 'planned_start'] as const;

export async function getTasks() {
  return findAllTasksWithLinen(pool);
}

export async function getTask(taskId: string) {
  const task = await findTaskWithLinen(pool, taskId);
  if (!task) {
    throw new HttpError(404, `Task ${taskId} not found`);
  }

  return task;
}

export async function getTaskLinenHistory(taskId: string) {
  await findExistingTask(pool, taskId);
  return findLinenHistory(pool, taskId);
}

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
    const before = await findExistingTask(db, taskId);
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

async function findExistingTask(db: DB, taskId: string) {
  const task = await findTask(db, taskId);
  if (!task) {
    throw new HttpError(404, `Task ${taskId} not found`);
  }

  return task;
}

function findChangedTriggerFields(before: Task, after: Task) {
  return RECALCULATION_TRIGGER_FIELDS.filter((field) =>
    field === 'planned_start'
      ? before.planned_start.getTime() !== after.planned_start.getTime()
      : before[field] !== after[field],
  );
}
