import type {DB} from '../../db/connection';
import {findListing} from '../listings/listing.repository';
import {findNextAttendingReservation, findReservation} from '../reservations/reservation.repository';
import {MAIN_CLEANING, type Task} from '../tasks/task.schemas';
import {calculateLinen} from './linen.calculator';
import {deleteLinen, findLinen, insertLinen, insertLinenHistory} from './linen.repository';
import type {LinenValues, TaskLinen} from './linen.types';

export async function computeLinen(db: DB, task: Task) {
  if (task.task_type !== MAIN_CLEANING || !task.listing_id || !task.reservation_id) {
    return null;
  }

  const listing = await findListing(db, task.listing_id);
  const current = await findReservation(db, task.reservation_id);
  if (!listing || !current) {
    return null;
  }

  const next = await findNextAttendingReservation(db, task.listing_id, current.planned_arrival_time);
  return calculateLinen(listing, task.planned_start, current, next);
}

export async function recalculateLinen(db: DB, task: Task, eventId: string, reason: string) {
  const linen = await findLinen(db, task.task_id);
  const oldValues = linen && toLinenValues(linen);
  const newValues = await computeLinen(db, task);
  if (!oldValues && !newValues) {
    return;
  }

  if (oldValues) {
    await deleteLinen(db, task.task_id);
  }

  if (newValues) {
    await insertLinen(db, task.task_id, newValues);
  }

  await insertLinenHistory(db, task.task_id, eventId, reason, oldValues, newValues);
}

function toLinenValues({task_id, ...values}: TaskLinen): LinenValues {
  return values;
}
