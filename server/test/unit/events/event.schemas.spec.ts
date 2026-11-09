import {describe, expect, it} from 'vitest';
import {reservationEventSchema} from '../../../src/modules/events/event.schemas';

const validUpdate = {
  event_id: 'E1',
  aggregate_id: 'R1',
  event_type: 'Reservation.Updated',
  created_at: '2026-03-09T08:00:00Z',
  changes: [{field: 'guests_count', old: 2, new: 3}],
};

const validCreate = {
  event_id: 'E1',
  aggregate_id: 'R1',
  event_type: 'Reservation.Created',
  created_at: '2026-03-09T08:00:00Z',
  reservation: {
    reservation_id: 'R1',
    listing_id: 'L1',
    status: 'Confirmed',
    planned_arrival_time: '2026-03-05T15:00:00Z',
    planned_departure_time: '2026-03-10T10:00:00Z',
    guests_count: 2,
    infants: 0,
    customFields: {},
  },
};

describe('reservationEventSchema', () => {
  it.each(['Reservation.Updated', 'Reservation.CustomFields.Updated'])('accepts %s', (event_type) => {
    expect(reservationEventSchema.safeParse({...validUpdate, event_type}).success).toBe(true);
  });

  it('parses the reservation of a Created event', () => {
    const event = reservationEventSchema.parse(validCreate);

    expect(event).toMatchObject({
      created_at: new Date('2026-03-09T08:00:00Z'),
      reservation: {planned_arrival_time: new Date('2026-03-05T15:00:00Z')},
    });
  });

  it('defaults changes to an empty list', () => {
    const {changes} = reservationEventSchema.parse({...validUpdate, changes: undefined});

    expect(changes).toEqual([]);
  });

  it('accepts a change of any value type', () => {
    const changes = [
      {field: 'requested_sofabed', old: false, new: true},
      {field: 'number_of_guests_override', old: null, new: 5},
    ];

    expect(reservationEventSchema.safeParse({...validUpdate, changes}).success).toBe(true);
  });

  it.each([
    {scenario: 'an unknown event_type', event: {...validUpdate, event_type: 'Reservation.Deleted'}},
    {scenario: 'a missing event_type', event: {...validUpdate, event_type: undefined}},
    {scenario: 'an empty event_id', event: {...validUpdate, event_id: ''}},
    {scenario: 'an empty aggregate_id', event: {...validUpdate, aggregate_id: ''}},
    {scenario: 'an invalid created_at', event: {...validUpdate, created_at: 'yesterday'}},
    {scenario: 'a change with an empty field', event: {...validUpdate, changes: [{field: '', old: 1, new: 2}]}},
    {scenario: 'changes that are not a list', event: {...validUpdate, changes: 'guests_count'}},
    {scenario: 'a Created event with no reservation', event: {...validCreate, reservation: undefined}},
    {scenario: 'a Created event with an invalid reservation', event: {...validCreate, reservation: {}}},
    {scenario: 'a Created event whose reservation_id differs', event: {...validCreate, aggregate_id: 'R2'}},
  ])('rejects $scenario', ({event}) => {
    expect(reservationEventSchema.safeParse(event).success).toBe(false);
  });
});
