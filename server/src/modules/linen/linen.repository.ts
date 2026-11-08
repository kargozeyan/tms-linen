import type {RowDataPacket} from 'mysql2/promise';
import type {DB} from '../../db/connection';
import type {LinenValues, TaskLinen} from './linen.types';

const FIND_QUERY = `SELECT * FROM task_linen WHERE task_id = ?`;

const INSERT_QUERY = `
    INSERT INTO task_linen (task_id, sheets, towels, bathmats, handtowels, dishtowels, prepared_for_guests,
                            requested_sofabeds_count, actual_guests, infants, number_of_guests_override,
                            requested_sofabed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const INSERT_HISTORY_QUERY = `
    INSERT INTO linen_history (task_id, event_id, reason, old_values, new_values, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`;

const DELETE_QUERY = `DELETE FROM task_linen WHERE task_id = ?`;

export async function findLinen(db: DB, taskId: string) {
  const [rows] = await db.query<RowDataPacket[]>(FIND_QUERY, [taskId]);
  return rows[0] ? toTaskLinen(rows[0]) : null;
}

export async function insertLinen(db: DB, taskId: string, linen: LinenValues) {
  await db.query(INSERT_QUERY, [
    taskId,
    linen.sheets,
    linen.towels,
    linen.bathmats,
    linen.handtowels,
    linen.dishtowels,
    linen.prepared_for_guests,
    linen.requested_sofabeds_count,
    linen.actual_guests,
    linen.infants,
    linen.number_of_guests_override,
    linen.requested_sofabed,
  ]);
}

export async function insertLinenHistory(
  db: DB,
  taskId: string,
  eventId: string,
  reason: string,
  oldValues: LinenValues | null,
  newValues: LinenValues | null,
) {
  await db.query(INSERT_HISTORY_QUERY, [
    taskId,
    eventId,
    reason,
    oldValues && JSON.stringify(oldValues),
    newValues && JSON.stringify(newValues),
    new Date(),
  ]);
}

export async function deleteLinen(db: DB, taskId: string) {
  await db.query(DELETE_QUERY, [taskId]);
}

function toTaskLinen({requested_sofabed, ...columns}: RowDataPacket) {
  return {...columns, requested_sofabed: Boolean(requested_sofabed)} as TaskLinen;
}
