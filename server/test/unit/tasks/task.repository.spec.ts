import {describe, expect, it} from 'vitest';
import {findAllTasksWithLinen, findTaskWithLinen} from '../../../src/modules/tasks/task.repository';
import {createFakeDb} from '../../fake-db';

const task = {task_id: 'T1', task_type: 'Main Cleaning'};
const rowWithLinen = {task, linen: {task_id: 'T1', sheets: 2, requested_sofabed: 1}};
const rowWithoutLinen = {task, linen: {task_id: null, sheets: null, requested_sofabed: null}};

describe('findTaskWithLinen', () => {
  it('nests the mapped linen under the task', async () => {
    const {db} = createFakeDb([rowWithLinen]);

    await expect(findTaskWithLinen(db, 'T1')).resolves.toEqual({
      ...task,
      linen: {task_id: 'T1', sheets: 2, requested_sofabed: true},
    });
  });

  it('returns null linen when the join finds no linen row', async () => {
    const {db} = createFakeDb([rowWithoutLinen]);

    await expect(findTaskWithLinen(db, 'T1')).resolves.toEqual({...task, linen: null});
  });

  it('groups each row by table using the nestTables option', async () => {
    const {db, query} = createFakeDb([rowWithLinen]);

    await findTaskWithLinen(db, 'T1');

    expect(query).toHaveBeenCalledWith(expect.objectContaining({nestTables: true}), ['T1']);
  });

  it('returns undefined when the task is not found', async () => {
    const {db} = createFakeDb([]);

    await expect(findTaskWithLinen(db, 'T1')).resolves.toBeUndefined();
  });
});

describe('findAllTasksWithLinen', () => {
  it('maps every row', async () => {
    const {db} = createFakeDb([rowWithLinen, rowWithoutLinen]);

    const tasks = await findAllTasksWithLinen(db);

    expect(tasks.map(({linen}) => linen?.sheets ?? null)).toEqual([2, null]);
  });
});
