import {z} from 'zod';
import {isoDate, nonEmptyString} from '../../shared/schemas';

export const MAIN_CLEANING = 'Main Cleaning';

const taskStatus = z.enum(['Pending', 'In Progress', 'Paused', 'Completed', 'Cancelled']);

export const taskSchema = z.object({
  task_id: nonEmptyString,
  task_type: nonEmptyString,
  status: taskStatus.default('Pending'),
  listing_id: nonEmptyString.nullable().default(null),
  reservation_id: nonEmptyString.nullable().default(null),
  planned_start: isoDate,
});

export type Task = z.output<typeof taskSchema>;
