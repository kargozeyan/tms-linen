import {describe, expect, it} from 'vitest';
import {findReservation, insertReservation} from '../../../src/modules/reservations/reservation.repository';
import {createReservation} from '../../factories';
import {createFakeDb} from '../../fake-db';

describe('findReservation', () => {
  it('maps the custom_fields column to customFields', async () => {
    const customFields = {number_of_guests_override: 3, requested_sofabed: true};
    const {db} = createFakeDb([{reservation_id: 'R1', custom_fields: customFields}]);

    await expect(findReservation(db, 'R1')).resolves.toEqual({reservation_id: 'R1', customFields});
  });

  it('returns undefined when the reservation is not found', async () => {
    const {db} = createFakeDb([]);

    await expect(findReservation(db, 'R1')).resolves.toBeUndefined();
  });
});

describe('insertReservation', () => {
  it('stores customFields as JSON', async () => {
    const reservation = createReservation({customFields: {number_of_guests_override: 3}});
    const {db, query} = createFakeDb();

    await insertReservation(db, reservation);

    const params = query.mock.calls[0]![1];
    expect(JSON.parse(params.at(-1))).toEqual(reservation.customFields);
  });
});
