import {describe, expect, it} from 'vitest';
import {reservationSchema} from '../../../src/modules/reservations/reservation.schemas';

const validReservation = {
  reservation_id: 'R1',
  listing_id: 'L1',
  status: 'Confirmed',
  planned_arrival_time: '2026-03-05T15:00:00Z',
  planned_departure_time: '2026-03-10T10:00:00Z',
  guests_count: 2,
  infants: 0,
  customFields: {number_of_guests_override: null, requested_sofabed: false},
};

function withCustomFields(customFields: object) {
  return {...validReservation, customFields};
}

describe('reservationSchema', () => {
  it('converts the planned times to dates', () => {
    const {planned_arrival_time, planned_departure_time} = reservationSchema.parse(validReservation);

    expect(planned_arrival_time).toEqual(new Date('2026-03-05T15:00:00Z'));
    expect(planned_departure_time).toEqual(new Date('2026-03-10T10:00:00Z'));
  });

  it('accepts a time with a timezone offset', () => {
    const reservation = {...validReservation, planned_arrival_time: '2026-03-05T19:00:00+04:00'};

    expect(reservationSchema.parse(reservation).planned_arrival_time).toEqual(new Date('2026-03-05T15:00:00Z'));
  });

  it('defaults the linen custom fields', () => {
    const {customFields} = reservationSchema.parse(withCustomFields({}));

    expect(customFields).toEqual({number_of_guests_override: null, requested_sofabed: false});
  });

  it('keeps other custom fields', () => {
    const {customFields} = reservationSchema.parse(withCustomFields({vip_note: 'late arrival'}));

    expect(customFields.vip_note).toBe('late arrival');
  });

  it.each([
    {scenario: 'an empty reservation_id', reservation: {...validReservation, reservation_id: ''}},
    {scenario: 'an empty listing_id', reservation: {...validReservation, listing_id: ''}},
    {scenario: 'an empty status', reservation: {...validReservation, status: ''}},
    {scenario: 'an invalid planned_arrival_time', reservation: {...validReservation, planned_arrival_time: 'soon'}},
    {scenario: 'an invalid planned_departure_time', reservation: {...validReservation, planned_departure_time: 'soon'}},
    {scenario: 'a negative guests_count', reservation: {...validReservation, guests_count: -1}},
    {scenario: 'a decimal guests_count', reservation: {...validReservation, guests_count: 1.5}},
    {scenario: 'a negative infants count', reservation: {...validReservation, infants: -1}},
    {scenario: 'a negative override', reservation: withCustomFields({number_of_guests_override: -1})},
    {scenario: 'a requested_sofabed that is not a boolean', reservation: withCustomFields({requested_sofabed: 'yes'})},
    {scenario: 'missing customFields', reservation: {...validReservation, customFields: undefined}},
  ])('rejects $scenario', ({reservation}) => {
    expect(reservationSchema.safeParse(reservation).success).toBe(false);
  });
});
