import type {RowDataPacket} from 'mysql2/promise';
import {MAIN_CLEANING, OPEN_TASK_STATUSES, type Task} from './task.schemas';
import type {DB} from '../../db/connection';

const FIND_OPEN_MAIN_CLEANING_QUERY = `
    SELECT * FROM tasks
    WHERE reservation_id = ? AND task_type = ? AND status IN (?)`;

const INSERT_QUERY = `INSERT INTO tasks (task_id, task_type, status, listing_id, reservation_id, planned_start)
     VALUES (?, ?, ?, ?, ?, ?)`;

const MOVE_OPEN_QUERY = `UPDATE tasks SET listing_id = ? WHERE reservation_id = ? AND status IN (?)`;

export async function findOpenMainCleaningTasks(db: DB, reservationId: string) {
  const [rows] = await db.query<RowDataPacket[]>(FIND_OPEN_MAIN_CLEANING_QUERY, [
    reservationId,
    MAIN_CLEANING,
    OPEN_TASK_STATUSES,
  ]);
  return rows as Task[];
}

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

export async function moveOpenTasks(db: DB, reservationId: string, listingId: string) {
  await db.query(MOVE_OPEN_QUERY, [listingId, reservationId, OPEN_TASK_STATUSES]);
}
