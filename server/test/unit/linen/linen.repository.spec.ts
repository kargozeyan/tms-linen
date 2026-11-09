import {describe, expect, it} from 'vitest';
import {findLinen, insertLinenHistory, toTaskLinen} from '../../../src/modules/linen/linen.repository';
import {createLinenValues} from '../../factories';
import {createFakeDb} from '../../fake-db';

describe('toTaskLinen', () => {
  it.each([
    {column: 0, expected: false},
    {column: 1, expected: true},
  ])('converts requested_sofabed $column to $expected and keeps the other columns', ({column, expected}) => {
    const linen = toTaskLinen({task_id: 'T1', sheets: 2, requested_sofabed: column} as never);

    expect(linen).toEqual({task_id: 'T1', sheets: 2, requested_sofabed: expected});
  });
});

describe('findLinen', () => {
  it('returns the mapped row', async () => {
    const {db, query} = createFakeDb([{task_id: 'T1', requested_sofabed: 1}]);

    await expect(findLinen(db, 'T1')).resolves.toEqual({task_id: 'T1', requested_sofabed: true});
    expect(query).toHaveBeenCalledWith(expect.any(String), ['T1']);
  });

  it('returns null when the task has no linen', async () => {
    const {db} = createFakeDb([]);

    await expect(findLinen(db, 'T1')).resolves.toBeNull();
  });
});

describe('insertLinenHistory', () => {
  it('stores old and new values as JSON', async () => {
    const oldValues = createLinenValues({towels: 4});
    const newValues = createLinenValues({towels: 6});
    const {db, query} = createFakeDb();

    await insertLinenHistory(db, 'T1', 'E1', 'Reason', oldValues, newValues);

    const [taskId, eventId, reason, storedOld, storedNew] = query.mock.calls[0]![1];
    expect([taskId, eventId, reason]).toEqual(['T1', 'E1', 'Reason']);
    expect(JSON.parse(storedOld)).toEqual(oldValues);
    expect(JSON.parse(storedNew)).toEqual(newValues);
  });

  it('stores missing values and a missing event as null', async () => {
    const {db, query} = createFakeDb();

    await insertLinenHistory(db, 'T1', null, 'Reason', null, null);

    const [, eventId, , storedOld, storedNew] = query.mock.calls[0]![1];
    expect([eventId, storedOld, storedNew]).toEqual([null, null, null]);
  });
});
