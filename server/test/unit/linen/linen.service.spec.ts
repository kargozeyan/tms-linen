import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {DB} from '../../../src/db/connection';
import {createLinenValues, createListing, createReservation, createTask, createTaskLinen} from '../../factories';
import {findListing} from '../../../src/modules/listings/listing.repository';
import {findNextAttendingReservation, findReservation} from '../../../src/modules/reservations/reservation.repository';
import {deleteLinen, findLinen, insertLinen, insertLinenHistory} from '../../../src/modules/linen/linen.repository';
import {computeLinen, recalculateLinen} from '../../../src/modules/linen/linen.service';

vi.mock('../../../src/modules/listings/listing.repository');
vi.mock('../../../src/modules/reservations/reservation.repository');
vi.mock('../../../src/modules/linen/linen.repository');

const db = {} as DB;
const EVENT_ID = 'E1';
const REASON = 'Reservation.Updated R2: guests_count';

const listing = createListing();
const current = createReservation({guests_count: 2});
const nextInWindow = createReservation({
  reservation_id: 'R2',
  guests_count: 5,
  planned_arrival_time: new Date('2026-03-11T15:00:00Z'),
});

const DEFAULT_LINEN = createLinenValues();
const LINEN_FOR_FIVE_GUESTS = createLinenValues({
  sheets: 3,
  towels: 5,
  handtowels: 6,
  prepared_for_guests: 5,
  requested_sofabeds_count: 1,
  actual_guests: 5,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findListing).mockResolvedValue(listing);
  vi.mocked(findReservation).mockResolvedValue(current);
  vi.mocked(findNextAttendingReservation).mockResolvedValue(undefined);
  vi.mocked(findLinen).mockResolvedValue(null);
});

describe('computeLinen', () => {
  describe('when the task cannot have linen', () => {
    it.each([
      {scenario: 'is not a Main Cleaning task', task: createTask({task_type: 'Deep Cleaning'})},
      {scenario: 'has no listing_id', task: createTask({listing_id: null})},
      {scenario: 'has no reservation_id', task: createTask({reservation_id: null})},
    ])('returns null without querying when it $scenario', async ({task}) => {
      await expect(computeLinen(db, task)).resolves.toBeNull();

      expect(findListing).not.toHaveBeenCalled();
      expect(findReservation).not.toHaveBeenCalled();
    });

    it('returns null when the listing is not found', async () => {
      vi.mocked(findListing).mockResolvedValue(undefined);

      await expect(computeLinen(db, createTask())).resolves.toBeNull();
    });

    it('returns null when the reservation is not found', async () => {
      vi.mocked(findReservation).mockResolvedValue(undefined);

      await expect(computeLinen(db, createTask())).resolves.toBeNull();
    });
  });

  describe('when the task can have linen', () => {
    it("looks up the task's listing, reservation and next reservation", async () => {
      await computeLinen(db, createTask({listing_id: 'L9', reservation_id: 'R9'}));

      expect(findListing).toHaveBeenCalledWith(db, 'L9');
      expect(findReservation).toHaveBeenCalledWith(db, 'R9');
      expect(findNextAttendingReservation).toHaveBeenCalledWith(db, 'L9', current.planned_arrival_time);
    });

    it('applies the default when there is no next reservation', async () => {
      await expect(computeLinen(db, createTask())).resolves.toEqual(DEFAULT_LINEN);
    });

    it('prepares for the next reservation inside the window', async () => {
      vi.mocked(findNextAttendingReservation).mockResolvedValue(nextInWindow);

      await expect(computeLinen(db, createTask())).resolves.toEqual(LINEN_FOR_FIVE_GUESTS);
    });

    it("measures the window from the task's planned_start", async () => {
      vi.mocked(findNextAttendingReservation).mockResolvedValue(nextInWindow);
      const lateTask = createTask({planned_start: new Date('2026-03-12T10:00:00Z')});

      await expect(computeLinen(db, lateTask)).resolves.toEqual(DEFAULT_LINEN);
    });
  });
});

describe('recalculateLinen', () => {
  it('writes nothing when the task has no linen and gets none', async () => {
    await recalculateLinen(db, createTask({task_type: 'Deep Cleaning'}), EVENT_ID, REASON);

    expect(deleteLinen).not.toHaveBeenCalled();
    expect(insertLinen).not.toHaveBeenCalled();
    expect(insertLinenHistory).not.toHaveBeenCalled();
  });

  it('inserts the linen and records it when the task gets linen for the first time', async () => {
    await recalculateLinen(db, createTask(), EVENT_ID, REASON);

    expect(deleteLinen).not.toHaveBeenCalled();
    expect(insertLinen).toHaveBeenCalledWith(db, 'T1', DEFAULT_LINEN);
    expect(insertLinenHistory).toHaveBeenCalledWith(db, 'T1', EVENT_ID, REASON, null, DEFAULT_LINEN);
  });

  it('replaces the linen and records old and new values without task_id when the linen changes', async () => {
    vi.mocked(findLinen).mockResolvedValue(createTaskLinen());
    vi.mocked(findNextAttendingReservation).mockResolvedValue(nextInWindow);

    await recalculateLinen(db, createTask(), EVENT_ID, REASON);

    expect(deleteLinen).toHaveBeenCalledWith(db, 'T1');
    expect(insertLinen).toHaveBeenCalledWith(db, 'T1', LINEN_FOR_FIVE_GUESTS);
    expect(vi.mocked(deleteLinen).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(insertLinen).mock.invocationCallOrder[0]!,
    );
    expect(insertLinenHistory).toHaveBeenCalledWith(db, 'T1', EVENT_ID, REASON, DEFAULT_LINEN, LINEN_FOR_FIVE_GUESTS);
  });

  it('still adds a history row when the linen stays the same', async () => {
    vi.mocked(findLinen).mockResolvedValue(createTaskLinen());

    await recalculateLinen(db, createTask(), EVENT_ID, REASON);

    expect(insertLinenHistory).toHaveBeenCalledWith(db, 'T1', EVENT_ID, REASON, DEFAULT_LINEN, DEFAULT_LINEN);
  });

  it('deletes the linen and records it when the task can no longer have linen', async () => {
    vi.mocked(findLinen).mockResolvedValue(createTaskLinen());

    await recalculateLinen(db, createTask({reservation_id: null}), EVENT_ID, REASON);

    expect(deleteLinen).toHaveBeenCalledWith(db, 'T1');
    expect(insertLinen).not.toHaveBeenCalled();
    expect(insertLinenHistory).toHaveBeenCalledWith(db, 'T1', EVENT_ID, REASON, DEFAULT_LINEN, null);
  });

  it('adds history with a null event_id when the recalculation has no event', async () => {
    await recalculateLinen(db, createTask(), null, 'Task created');

    expect(insertLinenHistory).toHaveBeenCalledWith(db, 'T1', null, 'Task created', null, DEFAULT_LINEN);
  });
});
