import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {pool} from '../../src/db/pool';
import {seed} from '../../src/scripts/seed';
import {query} from './support/database';
import {startTestApi, type TestApi} from './support/test-api';

let api: TestApi;

beforeAll(async () => {
  api = await startTestApi();
});

beforeEach(async () => {
  await seed();
});

afterAll(async () => {
  api.close();
  await pool.end();
});

const UPDATED = 'Reservation.Updated';
const CUSTOM_FIELDS_UPDATED = 'Reservation.CustomFields.Updated';

function createChangeEvent(eventId: string, reservationId: string, eventType: string, field: string, value: unknown) {
  return {
    event_id: eventId,
    aggregate_id: reservationId,
    created_at: '2026-03-09T08:00:00Z',
    event_type: eventType,
    changes: [{field, old: null, new: value}],
  };
}

function createCreatedEvent(eventId: string, reservationId: string, customFields: object = {}) {
  return {
    event_id: eventId,
    aggregate_id: reservationId,
    created_at: '2026-03-09T08:00:00Z',
    event_type: 'Reservation.Created',
    reservation: {
      reservation_id: reservationId,
      listing_id: 'L-S1',
      status: 'Confirmed',
      planned_arrival_time: '2030-01-01T15:00:00Z',
      planned_departure_time: '2030-01-05T10:00:00Z',
      guests_count: 2,
      infants: 0,
      customFields,
    },
  };
}

function setStatus(eventId: string, reservationId: string, status: string) {
  return api.postEvent(createChangeEvent(eventId, reservationId, UPDATED, 'status', status));
}

async function findReservation(reservationId: string) {
  const [reservation] = await query('SELECT * FROM reservations WHERE reservation_id = ?', [reservationId]);
  return reservation;
}

async function isEventRecorded(eventId: string) {
  const rows = await query('SELECT 1 FROM processed_events WHERE event_id = ?', [eventId]);
  return rows.length === 1;
}

describe('POST /events/reservation', () => {
  it('records the event and returns processed', async () => {
    const {status, body} = await api.postEvent(createChangeEvent('E-X', 'R-S1-B', UPDATED, 'guests_count', 5));

    expect([status, body]).toEqual([200, {status: 'processed'}]);
    await expect(isEventRecorded('E-X')).resolves.toBe(true);
    expect((await findReservation('R-S1-B'))?.guests_count).toBe(5);
  });

  it('stores a new reservation', async () => {
    const {status} = await api.postEvent(createCreatedEvent('E-X', 'R-NEW'));

    expect(status).toBe(200);
    await expect(findReservation('R-NEW')).resolves.toMatchObject({
      listing_id: 'L-S1',
      planned_arrival_time: new Date('2030-01-01T15:00:00Z'),
      custom_fields: {number_of_guests_override: null, requested_sofabed: false},
    });
  });

  it('returns duplicate, not 409, for a repeated Created event', async () => {
    const event = createCreatedEvent('E-X', 'R-NEW');

    await api.postEvent(event);
    const {status, body} = await api.postEvent(event);

    expect([status, body.status]).toEqual([200, 'duplicate']);
  });

  it('keeps other custom fields across later changes', async () => {
    await api.postEvent(createChangeEvent('E-1', 'R-S1-B', CUSTOM_FIELDS_UPDATED, 'vip_note', 'late arrival'));
    await api.postEvent(createChangeEvent('E-2', 'R-S1-B', CUSTOM_FIELDS_UPDATED, 'requested_sofabed', true));
    await api.postEvent(createChangeEvent('E-3', 'R-S1-B', UPDATED, 'guests_count', 2));

    const reservation = await findReservation('R-S1-B');
    expect(reservation?.custom_fields).toMatchObject({vip_note: 'late arrival', requested_sofabed: true});
  });

  it('keeps other custom fields from a Created event', async () => {
    await api.postEvent(createCreatedEvent('E-X', 'R-NEW', {source: 'airbnb'}));

    expect((await findReservation('R-NEW'))?.custom_fields.source).toBe('airbnb');
  });

  it('records a history row with the event and reason', async () => {
    await api.postEvent(createChangeEvent('E-X', 'R-S1-B', UPDATED, 'guests_count', 5));

    const {body: history} = await api.getTaskHistory('T-S1-A');
    expect(history).toMatchObject([
      {
        task_id: 'T-S1-A',
        event_id: 'E-X',
        reason: `${UPDATED} R-S1-B: guests_count`,
        old_values: {towels: 4, actual_guests: 1},
        new_values: {towels: 5, actual_guests: 5},
      },
    ]);
  });
});

describe('rejected events', () => {
  it.each([
    {scenario: 'an invalid body', event: {event_id: 'E-X'}, expectedStatus: 400},
    {
      scenario: 'an unknown event type',
      event: createChangeEvent('E-X', 'R-S1-B', 'Reservation.Deleted', 'guests_count', 2),
      expectedStatus: 400,
    },
    {
      scenario: 'an invalid new value',
      event: createChangeEvent('E-X', 'R-S1-B', UPDATED, 'guests_count', -1),
      expectedStatus: 400,
    },
    {
      scenario: 'an update of an unknown reservation',
      event: createChangeEvent('E-X', 'R-UNKNOWN', UPDATED, 'guests_count', 2),
      expectedStatus: 404,
    },
    {
      scenario: 'a Created event for an existing reservation',
      event: createCreatedEvent('E-X', 'R-S1-B'),
      expectedStatus: 409,
    },
  ])('rolls back $scenario', async ({event, expectedStatus}) => {
    const before = await findReservation('R-S1-B');

    const {status} = await api.postEvent(event);

    expect(status).toBe(expectedStatus);
    await expect(findReservation('R-S1-B')).resolves.toEqual(before);
    await expect(isEventRecorded('E-X')).resolves.toBe(false);
  });

  it('rejects a body that is not valid JSON with 400', async () => {
    const {status, body} = await api.postRawEvent('{"event_id":');

    expect(status).toBe(400);
    expect(body.error).toEqual(expect.any(String));
  });

  it('rolls back a database failure partway through an event', async () => {
    const {status, body} = await api.postEvent(createChangeEvent('E-X', 'R-S1-B', UPDATED, 'listing_id', 'L-UNKNOWN'));

    expect([status, body]).toEqual([500, {error: 'Internal server error'}]);
    expect((await findReservation('R-S1-B'))?.listing_id).toBe('L-S1');
    await expect(isEventRecorded('E-X')).resolves.toBe(false);
  });

  it('accepts a retried event once its reservation exists', async () => {
    const event = createChangeEvent('E-X', 'R-NEW', UPDATED, 'guests_count', 3);
    expect((await api.postEvent(event)).status).toBe(404);

    await api.postEvent(createCreatedEvent('E-Y', 'R-NEW'));
    const {status, body} = await api.postEvent(event);

    expect([status, body.status]).toEqual([200, 'processed']);
    expect((await findReservation('R-NEW'))?.guests_count).toBe(3);
  });
});

describe('finding the previous reservation', () => {
  it.each([
    {status: 'Confirmed', recalculated: true},
    {status: 'InHouse', recalculated: true},
    {status: 'Canceled', recalculated: false},
    {status: 'NoShow', recalculated: false},
    {status: 'CheckedOut', recalculated: false},
  ])('$status previous reservation: recalculated = $recalculated', async ({status, recalculated}) => {
    await setStatus('E-STATUS', 'R-S1-A', status);

    await api.postEvent(createChangeEvent('E-X', 'R-S1-B', UPDATED, 'guests_count', 5));

    const {body: history} = await api.getTaskHistory('T-S1-A');
    const rows = history.filter((row: any) => row.event_id === 'E-X');
    expect(rows).toHaveLength(recalculated ? 1 : 0);
  });

  it('uses the closest earlier reservation', async () => {
    await api.postEvent(createChangeEvent('E-X', 'R-S1-C', UPDATED, 'guests_count', 5));

    const {body: closestHistory} = await api.getTaskHistory('T-S1-B');
    const {body: earlierHistory} = await api.getTaskHistory('T-S1-A');
    expect(closestHistory).toHaveLength(1);
    expect(earlierHistory).toEqual([]);
  });
});

describe('finding the next reservation', () => {
  const FORCE_RECALCULATION = {planned_start: '2026-03-10T10:01:00Z'};

  it.each([
    {status: 'Confirmed', expectedGuests: 5},
    {status: 'CheckedOut', expectedGuests: 5},
    {status: 'Canceled', expectedGuests: 3},
    {status: 'NoShow', expectedGuests: 3},
  ])('$status reservation between: prepares for $expectedGuests guests', async ({status, expectedGuests}) => {
    await setStatus('E-STATUS', 'R-S10-X', status);

    await api.updateTask('T-S10-A', FORCE_RECALCULATION);

    const {body: task} = await api.getTask('T-S10-A');
    expect(task.linen.actual_guests).toBe(expectedGuests);
  });

  it('uses the closest later reservation', async () => {
    const {body: before} = await api.getTask('T-S1-A');
    expect(before.linen.actual_guests).toBe(1);

    await api.postEvent(createChangeEvent('E-X', 'R-S1-C', UPDATED, 'guests_count', 3));
    await api.updateTask('T-S1-A', FORCE_RECALCULATION);

    const {body: after} = await api.getTask('T-S1-A');
    expect(after.linen.actual_guests).toBe(1);
  });
});

describe('finding tasks to recalculate', () => {
  it.each([
    {status: 'Pending', recalculated: true},
    {status: 'In Progress', recalculated: true},
    {status: 'Paused', recalculated: true},
    {status: 'Completed', recalculated: false},
    {status: 'Cancelled', recalculated: false},
  ])('$status task: recalculated = $recalculated', async ({status, recalculated}) => {
    await api.updateTask('T-S1-A', {status});

    await api.postEvent(createChangeEvent('E-X', 'R-S1-B', UPDATED, 'guests_count', 5));

    const {body: history} = await api.getTaskHistory('T-S1-A');
    expect(history).toHaveLength(recalculated ? 1 : 0);
  });

  it('leaves tasks that are not Main Cleaning without linen', async () => {
    await api.postEvent(createChangeEvent('E-X', 'R-S1-B', UPDATED, 'guests_count', 5));

    const {body: task} = await api.getTask('T-X-DEEP');
    const {body: history} = await api.getTaskHistory('T-X-DEEP');
    expect(task.linen).toBeNull();
    expect(history).toEqual([]);
  });
});

describe('moving a reservation', () => {
  it('moves open tasks of every type and leaves closed tasks on the old listing', async () => {
    await api.updateTask('T-S1-A', {status: 'Completed'});

    await api.postEvent(createChangeEvent('E-X', 'R-S1-A', UPDATED, 'listing_id', 'L-S2'));

    const {body: closedTask} = await api.getTask('T-S1-A');
    const {body: openTask} = await api.getTask('T-X-DEEP');
    expect(closedTask.listing_id).toBe('L-S1');
    expect(openTask.listing_id).toBe('L-S2');
  });
});
