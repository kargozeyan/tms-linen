import {z} from 'zod';
import {count, isoDate, nonEmptyString} from '../../shared/schemas';

export const reservationSchema = z.object({
  reservation_id: nonEmptyString,
  listing_id: nonEmptyString,
  status: nonEmptyString,
  planned_arrival_time: isoDate,
  planned_departure_time: isoDate,
  guests_count: count,
  infants: count,
  customFields: z.looseObject({
    number_of_guests_override: count.nullable().default(null),
    requested_sofabed: z.boolean().default(false),
  }),
});

export type Reservation = z.output<typeof reservationSchema>;
