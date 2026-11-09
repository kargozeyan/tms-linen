import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {pool} from '../../src/db/pool';
import {seed} from '../../src/scripts/seed';
import {findEvent, toQuantities} from './support/fixtures';
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

const DEFAULT = {sheets: 2, towels: 4, bathmats: 1, handtowels: 5, dishtowels: 1, sofabeds: 0};
const FIVE_GUESTS = {sheets: 3, towels: 5, bathmats: 1, handtowels: 6, dishtowels: 1, sofabeds: 1};
const THREE_GUESTS_WITH_SOFABED = {sheets: 3, towels: 6, bathmats: 1, handtowels: 7, dishtowels: 1, sofabeds: 1};
const THREE_BEDROOMS = {sheets: 3, towels: 6, bathmats: 2, handtowels: 8, dishtowels: 1, sofabeds: 0};

function rowsFor(history: any[], eventId: string) {
  return history.filter((row) => row.event_id === eventId);
}

describe('required scenarios', () => {
  it('1. a guest count change updates the previous cleaning, and B stays calculated from C (E-101)', async () => {
    await api.sendEvents('E-101');

    const {body: taskA} = await api.getTask('T-S1-A');
    expect(toQuantities(taskA.linen)).toEqual(FIVE_GUESTS);
    expect(taskA.linen.actual_guests).toBe(5);

    const {body: taskB} = await api.getTask('T-S1-B');
    expect(toQuantities(taskB.linen)).toEqual(DEFAULT);
    expect(taskB.linen).toMatchObject({actual_guests: 1, infants: 1});
  });

  it('1. a change of an unrelated field triggers no recalculation (E-102)', async () => {
    await api.sendEvents('E-102');

    const {body: historyA} = await api.getTaskHistory('T-S1-A');
    const {body: historyB} = await api.getTaskHistory('T-S1-B');
    expect(historyA).toEqual([]);
    expect(historyB).toEqual([]);
  });

  it('2. a custom field change updates the previous cleaning (E-201, E-202)', async () => {
    const {body: before} = await api.getTask('T-S2-A');
    expect(toQuantities(before.linen)).toEqual(DEFAULT);

    await api.sendEvents('E-201');
    const {body: afterSofabed} = await api.getTask('T-S2-A');
    expect(toQuantities(afterSofabed.linen)).toEqual(THREE_GUESTS_WITH_SOFABED);
    expect(afterSofabed.linen.requested_sofabed).toBe(true);

    await api.sendEvents('E-202');
    const {body: afterOverride} = await api.getTask('T-S2-A');
    expect(toQuantities(afterOverride.linen)).toEqual(FIVE_GUESTS);
    expect(afterOverride.linen.number_of_guests_override).toBe(5);
  });

  it('3. the next reservation leaves and enters the 2-day window (E-301, E-302)', async () => {
    const {body: before} = await api.getTask('T-S3-A');
    expect(toQuantities(before.linen)).toEqual(THREE_GUESTS_WITH_SOFABED);

    await api.sendEvents('E-301');
    const {body: outside} = await api.getTask('T-S3-A');
    expect(toQuantities(outside.linen)).toEqual(DEFAULT);
    expect(outside.linen.actual_guests).toBe(2);

    await api.sendEvents('E-302');
    const {body: inside} = await api.getTask('T-S3-A');
    expect(toQuantities(inside.linen)).toEqual(THREE_GUESTS_WITH_SOFABED);
    expect(inside.linen.actual_guests).toBe(3);
  });

  it('4. a move recalculates its own tasks and the previous cleaning on the new listing (E-401)', async () => {
    const {body: previousBefore} = await api.getTask('T-S4-P');
    const {body: movedBefore} = await api.getTask('T-S4-MOVED');
    expect(toQuantities(previousBefore.linen)).toEqual(THREE_BEDROOMS);
    expect(toQuantities(movedBefore.linen)).toEqual(DEFAULT);

    await api.sendEvents('E-401');

    const {body: moved} = await api.getTask('T-S4-MOVED');
    expect(moved.listing_id).toBe('L-S4-NEW');
    expect(toQuantities(moved.linen)).toEqual(THREE_BEDROOMS);
    expect(moved.linen.actual_guests).toBe(2);

    const {body: previous} = await api.getTask('T-S4-P');
    expect(toQuantities(previous.linen)).toEqual({
      sheets: 4,
      towels: 8,
      bathmats: 2,
      handtowels: 10,
      dishtowels: 1,
      sofabeds: 1,
    });
    expect(previous.linen.actual_guests).toBe(4);

    const {body: nextHistory} = await api.getTaskHistory('T-S4-N');
    expect(nextHistory).toEqual([]);
  });

  it('5. a planned_start change recalculates with the new date (PATCH T-S5-A)', async () => {
    const {body: before} = await api.getTask('T-S5-A');
    expect(toQuantities(before.linen)).toEqual(DEFAULT);

    const {status} = await api.updateTask('T-S5-A', {planned_start: '2026-03-12T10:00:00Z'});

    expect(status).toBe(200);
    const {body: after} = await api.getTask('T-S5-A');
    expect(toQuantities(after.linen)).toEqual(THREE_GUESTS_WITH_SOFABED);
    const {body: history} = await api.getTaskHistory('T-S5-A');
    expect(history).toMatchObject([
      {
        reason: 'Task updated: planned_start',
        event_id: null,
        old_values: {towels: 4},
        new_values: {towels: 6},
      },
    ]);
  });

  it('6. the same event twice records one recalculation (E-601)', async () => {
    const event = findEvent('E-601');

    const first = await api.postEvent(event);
    const second = await api.postEvent(event);

    expect([first.status, first.body.status]).toEqual([200, 'processed']);
    expect([second.status, second.body.status]).toEqual([200, 'duplicate']);
    const {body: task} = await api.getTask('T-S6-A');
    expect(toQuantities(task.linen)).toEqual(FIVE_GUESTS);
    const {body: history} = await api.getTaskHistory('T-S6-A');
    expect(rowsFor(history, 'E-601')).toHaveLength(1);
  });

  it('7. a new reservation updates the previous cleaning (E-701)', async () => {
    const {body: before} = await api.getTask('T-S7-A');
    expect(before.linen.actual_guests).toBe(2);

    await api.sendEvents('E-701');

    const {body: after} = await api.getTask('T-S7-A');
    expect(toQuantities(after.linen)).toEqual(FIVE_GUESTS);
    expect(after.linen.actual_guests).toBe(5);
  });

  it('8. the linen of a Completed task does not change (E-801)', async () => {
    const {body: before} = await api.getTask('T-S8-A');

    await api.sendEvents('E-801');

    const {body: after} = await api.getTask('T-S8-A');
    expect(after.linen).toEqual(before.linen);
    const {body: history} = await api.getTaskHistory('T-S8-A');
    expect(history).toEqual([]);
  });

  it('9. a CheckedOut previous reservation is not recalculated (E-901, E-902)', async () => {
    await api.sendEvents('E-901', 'E-902');

    const {body: taskA} = await api.getTask('T-S9-A');
    expect(toQuantities(taskA.linen)).toEqual(DEFAULT);
    expect(taskA.linen.actual_guests).toBe(1);

    const {body: historyA} = await api.getTaskHistory('T-S9-A');
    expect(rowsFor(historyA, 'E-901')).toHaveLength(1);
    expect(rowsFor(historyA, 'E-902')).toHaveLength(0);

    const {body: taskB} = await api.getTask('T-S9-B');
    expect(taskB.linen.actual_guests).toBe(5);
  });

  it('10. a Canceled reservation is skipped when finding the next one (T-S10-A)', async () => {
    const {body: task} = await api.getTask('T-S10-A');

    expect(toQuantities(task.linen)).toEqual(THREE_GUESTS_WITH_SOFABED);
    expect(task.linen.actual_guests).toBe(3);
  });
});
