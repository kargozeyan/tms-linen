import type {DB} from '../../db/connection';
import {withPoolTransaction} from '../../db/transaction';
import {HttpError} from '../../shared/errors';
import {
  findPreviousActiveReservation,
  findReservationForUpdate,
  insertReservation,
  updateReservation,
} from '../reservations/reservation.repository';
import {type Reservation, reservationSchema} from '../reservations/reservation.schemas';
import {moveOpenTasks} from '../tasks/task.repository';
import {recalculateOpenMainCleaningTasks} from '../tasks/task.service';
import {insertProcessedEvent} from './event.repository';
import type {ReservationEvent} from './event.schemas';

const LINEN_CUSTOM_FIELDS = new Set(['number_of_guests_override', 'requested_sofabed']);
const RECALCULATION_TRIGGER_FIELDS = new Set([
  'guests_count',
  'infants',
  'planned_arrival_time',
  'listing_id',
  ...LINEN_CUSTOM_FIELDS,
]);
const RECALCULATION_TRIGGER_STATUSES = new Set<unknown>(['InHouse', 'CheckedOut']);

export async function handleReservationEvent(event: ReservationEvent) {
  return withPoolTransaction((db) => processEvent(db, event));
}

async function processEvent(db: DB, event: ReservationEvent) {
  const isNewEvent = await insertProcessedEvent(db, event.event_id);
  if (!isNewEvent) {
    return {status: 'duplicate'};
  }

  const before = await findReservationForUpdate(db, event.aggregate_id);
  const after = applyEvent(before, event);

  if (before) {
    await updateReservation(db, after);
  } else {
    await insertReservation(db, after);
  }

  if (before && before.listing_id !== after.listing_id) {
    await moveOpenTasks(db, after.reservation_id, after.listing_id);
  }

  if (triggersRecalculation(event)) {
    const previous = await findPreviousActiveReservation(db, after.listing_id, after.planned_arrival_time);
    const reason = describeEvent(event);
    await recalculateOpenMainCleaningTasks(db, after.reservation_id, event.event_id, reason);

    if (previous) {
      await recalculateOpenMainCleaningTasks(db, previous.reservation_id, event.event_id, reason);
    }
  }

  return {status: 'processed'};
}

function applyEvent(before: Reservation | undefined, event: ReservationEvent) {
  if (event.event_type === 'Reservation.Created') {
    if (before) {
      throw new HttpError(409, `Reservation ${event.aggregate_id} already exists`);
    }

    return event.reservation;
  }

  if (!before) {
    throw new HttpError(404, `Reservation ${event.aggregate_id} not found`);
  }

  return applyChanges(before, event);
}

function applyChanges(reservation: Reservation, event: ReservationEvent) {
  const customFields: Record<string, unknown> = {...reservation.customFields};
  const updated: Record<string, unknown> = {
    ...reservation,
    planned_arrival_time: reservation.planned_arrival_time.toISOString(),
    planned_departure_time: reservation.planned_departure_time.toISOString(),
    customFields,
  };

  for (const {field, new: value} of event.changes) {
    if (event.event_type === 'Reservation.CustomFields.Updated') {
      customFields[field] = value;
    }

    if (event.event_type === 'Reservation.Updated') {
      if (LINEN_CUSTOM_FIELDS.has(field)) {
        customFields[field] = value;
      } else if (field !== 'reservation_id') {
        updated[field] = value;
      }
    }
  }

  return reservationSchema.parse(updated);
}

function triggersRecalculation(event: ReservationEvent) {
  if (event.event_type === 'Reservation.Created') {
    return true;
  }

  if (event.event_type === 'Reservation.CustomFields.Updated') {
    return event.changes.some(({field}) => LINEN_CUSTOM_FIELDS.has(field));
  }

  if (event.event_type === 'Reservation.Updated') {
    return event.changes.some(
      ({field, new: value}) =>
        RECALCULATION_TRIGGER_FIELDS.has(field) || (field === 'status' && RECALCULATION_TRIGGER_STATUSES.has(value)),
    );
  }

  return false;
}

function describeEvent(event: ReservationEvent) {
  const fields = event.changes.map(({field}) => field).join(', ');
  return `${event.event_type} ${event.aggregate_id}${fields && `: ${fields}`}`;
}
