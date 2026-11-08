import {z} from 'zod';
import {isoDate, nonEmptyString} from '../../shared/schemas';

export const MAIN_CLEANING = 'Main Cleaning';
export const OPEN_TASK_STATUSES = ['Pending', 'In Progress', 'Paused'];

const taskStatus = z.enum(['Pending', 'In Progress', 'Paused', 'Completed', 'Cancelled']);

export const taskSchema = z.object({
  task_id: nonEmptyString,
  task_type: nonEmptyString,
  status: taskStatus.default('Pending'),
  listing_id: nonEmptyString.nullable().default(null),
  reservation_id: nonEmptyString.nullable().default(null),
  planned_start: isoDate,
});

export const updateTaskSchema = z.object({
  task_type: nonEmptyString.optional(),
  status: taskStatus.optional(),
  listing_id: nonEmptyString.nullable().optional(),
  reservation_id: nonEmptyString.nullable().optional(),
  planned_start: isoDate.optional(),
});

export type Task = z.output<typeof taskSchema>;
export type TaskChanges = z.output<typeof updateTaskSchema>;
