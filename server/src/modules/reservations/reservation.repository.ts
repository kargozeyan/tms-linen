import type {RowDataPacket} from 'mysql2/promise';
import type {Reservation} from './reservation.schemas';
import type {DB} from '../../db/connection';

const FIND_QUERY = `SELECT * FROM reservations WHERE reservation_id = ?`;

const FIND_FOR_UPDATE_QUERY = `SELECT * FROM reservations WHERE reservation_id = ? FOR UPDATE`;

const FIND_NEXT_ATTENDING_QUERY = `
    SELECT * FROM reservations
    WHERE listing_id = ? AND planned_arrival_time > ? AND status NOT IN ('Canceled', 'NoShow')
    ORDER BY planned_arrival_time
    LIMIT 1`;

const FIND_PREVIOUS_ACTIVE_QUERY = `
    SELECT * FROM reservations
    WHERE listing_id = ? AND planned_arrival_time < ? AND status NOT IN ('Canceled', 'NoShow', 'CheckedOut')
    ORDER BY planned_arrival_time DESC
    LIMIT 1`;

const INSERT_QUERY = `
    INSERT INTO reservations (reservation_id, listing_id, status, planned_arrival_time, planned_departure_time,
                              guests_count, infants, custom_fields)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

const UPDATE_QUERY = `
    UPDATE reservations
    SET listing_id = ?, status = ?, planned_arrival_time = ?, planned_departure_time = ?,
        guests_count = ?, infants = ?, custom_fields = ?
    WHERE reservation_id = ?`;

export async function findReservation(db: DB, reservationId: string) {
  const [rows] = await db.query<RowDataPacket[]>(FIND_QUERY, [reservationId]);
  return toReservation(rows[0]);
}

export async function findReservationForUpdate(db: DB, reservationId: string) {
  const [rows] = await db.query<RowDataPacket[]>(FIND_FOR_UPDATE_QUERY, [reservationId]);
  return toReservation(rows[0]);
}

export async function findNextAttendingReservation(db: DB, listingId: string, arrival: Date) {
  const [rows] = await db.query<RowDataPacket[]>(FIND_NEXT_ATTENDING_QUERY, [listingId, arrival]);
  return toReservation(rows[0]);
}

export async function findPreviousActiveReservation(db: DB, listingId: string, arrival: Date) {
  const [rows] = await db.query<RowDataPacket[]>(FIND_PREVIOUS_ACTIVE_QUERY, [listingId, arrival]);
  return toReservation(rows[0]);
}

export async function insertReservation(db: DB, reservation: Reservation) {
  await db.query(INSERT_QUERY, [
    reservation.reservation_id,
    reservation.listing_id,
    reservation.status,
    reservation.planned_arrival_time,
    reservation.planned_departure_time,
    reservation.guests_count,
    reservation.infants,
    JSON.stringify(reservation.customFields),
  ]);
}

export async function updateReservation(db: DB, reservation: Reservation) {
  await db.query(UPDATE_QUERY, [
    reservation.listing_id,
    reservation.status,
    reservation.planned_arrival_time,
    reservation.planned_departure_time,
    reservation.guests_count,
    reservation.infants,
    JSON.stringify(reservation.customFields),
    reservation.reservation_id,
  ]);
}

function toReservation(row: RowDataPacket | undefined) {
  if (!row) return undefined;
  const {custom_fields, ...columns} = row;
  return {...columns, customFields: custom_fields} as unknown as Reservation;
}
