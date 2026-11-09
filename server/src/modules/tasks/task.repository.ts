import type {RowDataPacket} from 'mysql2/promise';
import {MAIN_CLEANING, OPEN_TASK_STATUSES, type Task} from './task.schemas';
import type {DB} from '../../db/connection';
import {toTaskLinen} from '../linen/linen.repository';

const FIND_QUERY = `SELECT * FROM tasks WHERE task_id = ?`;

const FIND_WITH_LINEN_QUERY = `
    SELECT * FROM tasks task
    LEFT JOIN task_linen linen ON linen.task_id = task.task_id
    WHERE task.task_id = ?`;

const FIND_ALL_WITH_LINEN_QUERY = `
    SELECT * FROM tasks task
    LEFT JOIN task_linen linen ON linen.task_id = task.task_id
    ORDER BY task.planned_start DESC, task.task_id`;

const FIND_OPEN_MAIN_CLEANING_QUERY = `
    SELECT * FROM tasks
    WHERE reservation_id = ? AND task_type = ? AND status IN (?)`;

const INSERT_QUERY = `INSERT INTO tasks (task_id, task_type, status, listing_id, reservation_id, planned_start)
     VALUES (?, ?, ?, ?, ?, ?)`;

const UPDATE_QUERY = `
    UPDATE tasks
    SET task_type = ?, status = ?, listing_id = ?, reservation_id = ?, planned_start = ?
    WHERE task_id = ?`;

const MOVE_OPEN_QUERY = `UPDATE tasks SET listing_id = ? WHERE reservation_id = ? AND status IN (?)`;

export async function findTask(db: DB, taskId: string) {
  const [rows] = await db.query<RowDataPacket[]>(FIND_QUERY, [taskId]);
  return rows[0] as Task | undefined;
}

export async function findTaskWithLinen(db: DB, taskId: string) {
  const [rows] = await db.query<RowDataPacket[]>({sql: FIND_WITH_LINEN_QUERY, nestTables: true}, [taskId]);
  return rows[0] ? toTaskWithLinen(rows[0]) : undefined;
}

export async function findAllTasksWithLinen(db: DB) {
  const [rows] = await db.query<RowDataPacket[]>({sql: FIND_ALL_WITH_LINEN_QUERY, nestTables: true});
  return rows.map(toTaskWithLinen);
}

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

export async function updateTask(db: DB, task: Task) {
  await db.query(UPDATE_QUERY, [
    task.task_type,
    task.status,
    task.listing_id,
    task.reservation_id,
    task.planned_start,
    task.task_id,
  ]);
}

export async function moveOpenTasks(db: DB, reservationId: string, listingId: string) {
  await db.query(MOVE_OPEN_QUERY, [listingId, reservationId, OPEN_TASK_STATUSES]);
}

function toTaskWithLinen({task, linen}: RowDataPacket) {
  return {...task, linen: linen.task_id ? toTaskLinen(linen) : null};
}
