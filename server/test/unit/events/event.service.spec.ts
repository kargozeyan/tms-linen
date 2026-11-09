import {beforeEach, describe, expect, it, vi} from 'vitest';
import {z} from 'zod';
import type {DB} from '../../../src/db/connection';
import {insertProcessedEvent} from '../../../src/modules/events/event.repository';
import type {ReservationEvent} from '../../../src/modules/events/event.schemas';
import {handleReservationEvent} from '../../../src/modules/events/event.service';
import {
  findPreviousActiveReservation,
  findReservationForUpdate,
  insertReservation,
  updateReservation,
} from '../../../src/modules/reservations/reservation.repository';
import {moveOpenTasks} from '../../../src/modules/tasks/task.repository';
import {recalculateOpenMainCleaningTasks} from '../../../src/modules/tasks/task.service';
import {createReservation} from '../../factories';

const {db} = vi.hoisted(() => ({db: {} as DB}));

vi.mock('../../../src/db/transaction', () => ({
  withPoolTransaction: (run: (connection: DB) => unknown) => run(db),
}));
vi.mock('../../../src/modules/tasks/task.service', () => ({recalculateOpenMainCleaningTasks: vi.fn()}));
vi.mock('../../../src/modules/events/event.repository');
vi.mock('../../../src/modules/reservations/reservation.repository');
vi.mock('../../../src/modules/tasks/task.repository');

const CREATED = 'Reservation.Created';
const UPDATED = 'Reservation.Updated';
const CUSTOM_FIELDS_UPDATED = 'Reservation.CustomFields.Updated';

const stored = createReservation({
  planned_arrival_time: new Date('2026-03-11T15:00:00Z'),
  customFields: {vip_note: 'late arrival'},
});
const previous = createReservation({reservation_id: 'R0'});

function createEvent(
  eventType: typeof UPDATED | typeof CUSTOM_FIELDS_UPDATED,
  ...changes: [field: string, value: unknown][]
): ReservationEvent {
  return {
    event_id: 'E1',
    aggregate_id: 'R1',
    created_at: new Date('2026-03-09T08:00:00Z'),
    event_type: eventType,
    changes: changes.map(([field, value]) => ({field, old: null, new: value})),
  };
}

function createCreatedEvent(): ReservationEvent {
  return {
    event_id: 'E1',
    aggregate_id: 'R1',
    created_at: new Date('2026-03-09T08:00:00Z'),
    event_type: CREATED,
    changes: [],
    reservation: stored,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(insertProcessedEvent).mockResolvedValue(true);
  vi.mocked(findReservationForUpdate).mockResolvedValue(stored);
  vi.mocked(findPreviousActiveReservation).mockResolvedValue(undefined);
});

describe('handleReservationEvent', () => {
  it('skips an event that was already processed', async () => {
    vi.mocked(insertProcessedEvent).mockResolvedValue(false);

    await expect(handleReservationEvent(createEvent(UPDATED, ['guests_count', 5]))).resolves.toEqual({
      status: 'duplicate',
    });

    expect(insertProcessedEvent).toHaveBeenCalledWith(db, 'E1');
    expect(findReservationForUpdate).not.toHaveBeenCalled();
    expect(updateReservation).not.toHaveBeenCalled();
    expect(recalculateOpenMainCleaningTasks).not.toHaveBeenCalled();
  });

  describe('Reservation.Created', () => {
    beforeEach(() => {
      vi.mocked(findReservationForUpdate).mockResolvedValue(undefined);
    });

    it('inserts the reservation and recalculates its tasks', async () => {
      await expect(handleReservationEvent(createCreatedEvent())).resolves.toEqual({status: 'processed'});

      expect(insertReservation).toHaveBeenCalledWith(db, stored);
      expect(updateReservation).not.toHaveBeenCalled();
      expect(moveOpenTasks).not.toHaveBeenCalled();
      expect(recalculateOpenMainCleaningTasks).toHaveBeenCalledWith(db, 'R1', 'E1', `${CREATED} R1`);
    });

    it('rejects a reservation that already exists without writing', async () => {
      vi.mocked(findReservationForUpdate).mockResolvedValue(stored);

      await expect(handleReservationEvent(createCreatedEvent())).rejects.toMatchObject({
        status: 409,
        message: 'Reservation R1 already exists',
      });

      expect(insertReservation).not.toHaveBeenCalled();
      expect(updateReservation).not.toHaveBeenCalled();
    });
  });

  describe('updates', () => {
    it('rejects an unknown reservation without writing', async () => {
      vi.mocked(findReservationForUpdate).mockResolvedValue(undefined);

      await expect(handleReservationEvent(createEvent(UPDATED, ['guests_count', 5]))).rejects.toMatchObject({
        status: 404,
        message: 'Reservation R1 not found',
      });

      expect(insertReservation).not.toHaveBeenCalled();
      expect(updateReservation).not.toHaveBeenCalled();
    });

    it('applies every change and keeps the other fields', async () => {
      await handleReservationEvent(
        createEvent(UPDATED, ['guests_count', 5], ['planned_departure_time', '2026-03-14T12:00:00Z']),
      );

      expect(updateReservation).toHaveBeenCalledWith(db, {
        ...stored,
        guests_count: 5,
        planned_departure_time: new Date('2026-03-14T12:00:00Z'),
      });
    });

    it('rejects an invalid new value without writing', async () => {
      const event = createEvent(UPDATED, ['guests_count', -1]);

      await expect(handleReservationEvent(event)).rejects.toBeInstanceOf(z.ZodError);

      expect(updateReservation).not.toHaveBeenCalled();
    });

    it.each([
      {scenario: 'Reservation.Updated with a linen custom field', eventType: UPDATED, field: 'requested_sofabed'},
      {scenario: 'Reservation.CustomFields.Updated', eventType: CUSTOM_FIELDS_UPDATED, field: 'requested_sofabed'},
    ] as const)('stores the value in customFields for $scenario', async ({eventType, field}) => {
      await handleReservationEvent(createEvent(eventType, [field, true]));

      expect(updateReservation).toHaveBeenCalledWith(db, {
        ...stored,
        customFields: {...stored.customFields, requested_sofabed: true},
      });
    });

    it('stores other custom fields without changing a column of the same name', async () => {
      await handleReservationEvent(createEvent(CUSTOM_FIELDS_UPDATED, ['guests_count', 9]));

      expect(updateReservation).toHaveBeenCalledWith(db, {
        ...stored,
        customFields: {...stored.customFields, guests_count: 9},
      });
    });

    it('ignores a change of reservation_id', async () => {
      await handleReservationEvent(createEvent(UPDATED, ['reservation_id', 'R2']));

      expect(updateReservation).toHaveBeenCalledWith(db, stored);
    });

    it('allows a custom field named reservation_id', async () => {
      await handleReservationEvent(createEvent(CUSTOM_FIELDS_UPDATED, ['reservation_id', 'R2']));

      expect(updateReservation).toHaveBeenCalledWith(db, {
        ...stored,
        customFields: {...stored.customFields, reservation_id: 'R2'},
      });
    });
  });

  describe('moving to another listing', () => {
    it('moves the open tasks and looks for the previous reservation on the new listing', async () => {
      await handleReservationEvent(createEvent(UPDATED, ['listing_id', 'L2']));

      expect(moveOpenTasks).toHaveBeenCalledWith(db, 'R1', 'L2');
      expect(findPreviousActiveReservation).toHaveBeenCalledWith(db, 'L2', stored.planned_arrival_time);
    });

    it('does not move tasks when the listing stays the same', async () => {
      await handleReservationEvent(createEvent(UPDATED, ['listing_id', stored.listing_id]));

      expect(moveOpenTasks).not.toHaveBeenCalled();
    });
  });

  describe('recalculation triggers', () => {
    it.each([
      {field: 'guests_count', value: 5},
      {field: 'infants', value: 1},
      {field: 'planned_arrival_time', value: '2026-03-11T16:00:00Z'},
      {field: 'listing_id', value: 'L2'},
      {field: 'number_of_guests_override', value: 5},
      {field: 'requested_sofabed', value: true},
      {field: 'status', value: 'InHouse'},
      {field: 'status', value: 'CheckedOut'},
    ])('Reservation.Updated with $field = $value recalculates', async ({field, value}) => {
      await handleReservationEvent(createEvent(UPDATED, [field, value]));

      expect(recalculateOpenMainCleaningTasks).toHaveBeenCalledOnce();
    });

    it.each([
      {field: 'number_of_guests_override', value: 5},
      {field: 'requested_sofabed', value: true},
    ])('Reservation.CustomFields.Updated with $field recalculates', async ({field, value}) => {
      await handleReservationEvent(createEvent(CUSTOM_FIELDS_UPDATED, [field, value]));

      expect(recalculateOpenMainCleaningTasks).toHaveBeenCalledOnce();
    });

    it.each([
      {eventType: UPDATED, field: 'planned_departure_time', value: '2026-03-14T12:00:00Z'},
      {eventType: UPDATED, field: 'status', value: 'Canceled'},
      {eventType: UPDATED, field: 'status', value: 'NoShow'},
      {eventType: CUSTOM_FIELDS_UPDATED, field: 'vip_note', value: 'late arrival'},
      {eventType: CUSTOM_FIELDS_UPDATED, field: 'guests_count', value: 9},
      {eventType: CUSTOM_FIELDS_UPDATED, field: 'status', value: 'InHouse'},
    ] as const)('$eventType with $field = $value does not recalculate', async ({eventType, field, value}) => {
      await expect(handleReservationEvent(createEvent(eventType, [field, value]))).resolves.toEqual({
        status: 'processed',
      });

      expect(findPreviousActiveReservation).not.toHaveBeenCalled();
      expect(recalculateOpenMainCleaningTasks).not.toHaveBeenCalled();
    });

    it('recalculates when any one of several changes is a trigger', async () => {
      await handleReservationEvent(
        createEvent(UPDATED, ['planned_departure_time', '2026-03-14T12:00:00Z'], ['guests_count', 5]),
      );

      expect(recalculateOpenMainCleaningTasks).toHaveBeenCalledOnce();
    });
  });

  describe('recalculating', () => {
    it("recalculates the reservation's own tasks, then the previous reservation's", async () => {
      vi.mocked(findPreviousActiveReservation).mockResolvedValue(previous);
      const reason = `${UPDATED} R1: guests_count`;

      await handleReservationEvent(createEvent(UPDATED, ['guests_count', 5]));

      expect(vi.mocked(recalculateOpenMainCleaningTasks).mock.calls).toEqual([
        [db, 'R1', 'E1', reason],
        [db, 'R0', 'E1', reason],
      ]);
    });

    it('recalculates only its own tasks when there is no previous reservation', async () => {
      await handleReservationEvent(createEvent(UPDATED, ['guests_count', 5]));

      expect(recalculateOpenMainCleaningTasks).toHaveBeenCalledOnce();
      expect(recalculateOpenMainCleaningTasks).toHaveBeenCalledWith(db, 'R1', 'E1', expect.any(String));
    });

    it('looks for the previous reservation using the new arrival time', async () => {
      await handleReservationEvent(createEvent(UPDATED, ['planned_arrival_time', '2026-03-12T15:00:00Z']));

      expect(findPreviousActiveReservation).toHaveBeenCalledWith(
        db,
        stored.listing_id,
        new Date('2026-03-12T15:00:00Z'),
      );
    });

    it('lists every changed field in the reason', async () => {
      await handleReservationEvent(createEvent(UPDATED, ['guests_count', 5], ['infants', 1]));

      expect(recalculateOpenMainCleaningTasks).toHaveBeenCalledWith(
        db,
        'R1',
        'E1',
        `${UPDATED} R1: guests_count, infants`,
      );
    });
  });
});
