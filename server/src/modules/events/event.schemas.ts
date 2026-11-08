import {z} from 'zod';
import {isoDate, nonEmptyString} from '../../shared/schemas';
import {reservationSchema} from '../reservations/reservation.schemas';

const eventFields = {
  event_id: nonEmptyString,
  aggregate_id: nonEmptyString,
  created_at: isoDate,
  changes: z.array(z.object({field: nonEmptyString, old: z.unknown(), new: z.unknown()})).default([]),
};

export const reservationEventSchema = z
  .discriminatedUnion('event_type', [
    z.object({...eventFields, event_type: z.literal('Reservation.Created'), reservation: reservationSchema}),
    z.object({...eventFields, event_type: z.enum(['Reservation.Updated', 'Reservation.CustomFields.Updated'])}),
  ])
  .refine(
    (event) => event.event_type !== 'Reservation.Created' || event.reservation.reservation_id === event.aggregate_id,
    {message: 'reservation.reservation_id must match aggregate_id'},
  );

export type ReservationEvent = z.output<typeof reservationEventSchema>;
