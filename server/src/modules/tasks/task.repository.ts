import type {Task} from './task.schemas';
import type {DB} from '../../db/connection';

const INSERT_QUERY = `INSERT INTO tasks (task_id, task_type, status, listing_id, reservation_id, planned_start)
     VALUES (?, ?, ?, ?, ?, ?)`;

export async function insertTask(db: DB, task: Task): Promise<void> {
  await db.query(INSERT_QUERY, [
    task.task_id,
    task.task_type,
    task.status,
    task.listing_id,
    task.reservation_id,
    task.planned_start,
  ]);
}
