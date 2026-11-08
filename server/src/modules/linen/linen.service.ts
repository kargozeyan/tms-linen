import type {DB} from '../../db/connection';
import {findListing} from '../listings/listing.repository';
import {findNextReservation, findReservation} from '../reservations/reservation.repository';
import {MAIN_CLEANING, type Task} from '../tasks/task.schemas';
import {calculateLinen} from './linen.calculator';

export async function computeLinen(db: DB, task: Task) {
  if (task.task_type !== MAIN_CLEANING || !task.listing_id || !task.reservation_id) {
    return null;
  }

  const listing = await findListing(db, task.listing_id);
  const current = await findReservation(db, task.reservation_id);
  if (!listing || !current) {
    return null;
  }

  const next = await findNextReservation(db, task.listing_id, current.planned_arrival_time);
  return calculateLinen(listing, task.planned_start, current, next);
}
