import type {RowDataPacket} from 'mysql2/promise';
import type {Reservation} from './reservation.schemas';
import type {DB} from '../../db/connection';

const FIND_QUERY = `SELECT * FROM reservations WHERE reservation_id = ?`;

const FIND_NEXT_QUERY = `
    SELECT * FROM reservations
    WHERE listing_id = ? AND planned_arrival_time > ? AND status NOT IN ('Canceled', 'NoShow')
    ORDER BY planned_arrival_time
    LIMIT 1`;

const INSERT_QUERY = `
    INSERT INTO reservations (reservation_id, listing_id, status, planned_arrival_time, planned_departure_time,
                              guests_count, infants, custom_fields)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

export async function findReservation(db: DB, reservationId: string) {
  const [rows] = await db.query<RowDataPacket[]>(FIND_QUERY, [reservationId]);
  return toReservation(rows[0]);
}

export async function findNextReservation(db: DB, listingId: string, arrival: Date) {
  const [rows] = await db.query<RowDataPacket[]>(FIND_NEXT_QUERY, [listingId, arrival]);
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

function toReservation(row: RowDataPacket | undefined) {
  if (!row) return undefined;
  const {custom_fields, ...columns} = row;
  return {...columns, customFields: custom_fields} as unknown as Reservation;
}
