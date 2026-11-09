import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {DB} from '../../../src/db/connection';
import {findLinenHistory} from '../../../src/modules/linen/linen.repository';
import {recalculateLinen} from '../../../src/modules/linen/linen.service';
import {
  findAllTasksWithLinen,
  findOpenMainCleaningTasks,
  findTask,
  findTaskWithLinen,
  insertTask,
  updateTask,
} from '../../../src/modules/tasks/task.repository';
import {
  createTask,
  getTask,
  getTaskLinenHistory,
  getTasks,
  patchTask,
  recalculateOpenMainCleaningTasks,
} from '../../../src/modules/tasks/task.service';
import {createTask as createTaskData, createTaskLinen} from '../../factories';

const {db, pool} = vi.hoisted(() => ({db: {} as DB, pool: {} as DB}));

vi.mock('../../../src/db/pool', () => ({pool}));
vi.mock('../../../src/db/transaction', () => ({
  withPoolTransaction: (run: (connection: DB) => unknown) => run(db),
}));
vi.mock('../../../src/modules/linen/linen.repository');
vi.mock('../../../src/modules/linen/linen.service');
vi.mock('../../../src/modules/tasks/task.repository');

const stored = createTaskData();
const taskWithLinen = {...stored, linen: createTaskLinen()};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findTask).mockResolvedValue(stored);
});

describe('getTasks', () => {
  it('returns all tasks with their linen', async () => {
    vi.mocked(findAllTasksWithLinen).mockResolvedValue([taskWithLinen]);

    await expect(getTasks()).resolves.toEqual([taskWithLinen]);
    expect(findAllTasksWithLinen).toHaveBeenCalledWith(pool);
  });
});

describe('getTask', () => {
  it('returns the task with its linen', async () => {
    vi.mocked(findTaskWithLinen).mockResolvedValue(taskWithLinen);

    await expect(getTask('T1')).resolves.toEqual(taskWithLinen);
    expect(findTaskWithLinen).toHaveBeenCalledWith(pool, 'T1');
  });

  it('rejects an unknown task', async () => {
    vi.mocked(findTaskWithLinen).mockResolvedValue(undefined);

    await expect(getTask('T9')).rejects.toMatchObject({status: 404, message: 'Task T9 not found'});
  });
});

describe('getTaskLinenHistory', () => {
  it("returns the task's history", async () => {
    const history = [
      {
        id: 1,
        task_id: 'T1',
        event_id: null,
        reason: 'Reason',
        old_values: null,
        new_values: null,
        created_at: new Date(),
      },
    ];
    vi.mocked(findLinenHistory).mockResolvedValue(history);

    await expect(getTaskLinenHistory('T1')).resolves.toEqual(history);
    expect(findLinenHistory).toHaveBeenCalledWith(pool, 'T1');
  });

  it('rejects an unknown task without reading history', async () => {
    vi.mocked(findTask).mockResolvedValue(undefined);

    await expect(getTaskLinenHistory('T9')).rejects.toMatchObject({status: 404, message: 'Task T9 not found'});
    expect(findLinenHistory).not.toHaveBeenCalled();
  });
});

describe('createTask', () => {
  it('inserts the task, calculates its linen and returns it', async () => {
    vi.mocked(findTask).mockResolvedValue(undefined);

    await expect(createTask(stored)).resolves.toEqual(stored);

    expect(insertTask).toHaveBeenCalledWith(db, stored);
    expect(recalculateLinen).toHaveBeenCalledWith(db, stored, null, 'Task created');
  });

  it('calculates linen for a task created as Completed', async () => {
    vi.mocked(findTask).mockResolvedValue(undefined);
    const completed = createTaskData({status: 'Completed'});

    await createTask(completed);

    expect(recalculateLinen).toHaveBeenCalledWith(db, completed, null, 'Task created');
  });

  it('rejects an existing task_id without writing', async () => {
    await expect(createTask(stored)).rejects.toMatchObject({status: 409, message: 'Task T1 already exists'});

    expect(insertTask).not.toHaveBeenCalled();
    expect(recalculateLinen).not.toHaveBeenCalled();
  });
});

describe('patchTask', () => {
  const LATER = new Date('2026-03-12T10:00:00Z');

  it('rejects an unknown task without writing', async () => {
    vi.mocked(findTask).mockResolvedValue(undefined);

    await expect(patchTask('T9', {status: 'Paused'})).rejects.toMatchObject({
      status: 404,
      message: 'Task T9 not found',
    });

    expect(updateTask).not.toHaveBeenCalled();
    expect(recalculateLinen).not.toHaveBeenCalled();
  });

  it('saves the merged task and returns it', async () => {
    const expected = {...stored, status: 'Paused' as const};

    await expect(patchTask('T1', {status: 'Paused'})).resolves.toEqual(expected);

    expect(updateTask).toHaveBeenCalledWith(db, expected);
  });

  describe('recalculation triggers', () => {
    it.each([
      {field: 'task_type', changes: {task_type: 'Deep Cleaning'}},
      {field: 'listing_id', changes: {listing_id: 'L2'}},
      {field: 'listing_id', changes: {listing_id: null}},
      {field: 'reservation_id', changes: {reservation_id: 'R2'}},
      {field: 'reservation_id', changes: {reservation_id: null}},
      {field: 'planned_start', changes: {planned_start: LATER}},
    ])('recalculates with the merged task when $field changes to $changes', async ({field, changes}) => {
      await patchTask('T1', changes);

      expect(recalculateLinen).toHaveBeenCalledWith(db, {...stored, ...changes}, null, `Task updated: ${field}`);
    });

    it('lists every changed field in the reason', async () => {
      await patchTask('T1', {planned_start: LATER, listing_id: 'L2'});

      expect(recalculateLinen).toHaveBeenCalledWith(
        db,
        expect.anything(),
        null,
        'Task updated: listing_id, planned_start',
      );
    });

    it.each([
      {scenario: 'a status change', changes: {status: 'Paused' as const}},
      {scenario: 'an empty change', changes: {}},
      {scenario: 'the same task_type', changes: {task_type: stored.task_type}},
      {scenario: 'the same listing_id', changes: {listing_id: stored.listing_id}},
      {scenario: 'the same reservation_id', changes: {reservation_id: stored.reservation_id}},
      {scenario: 'the same planned_start', changes: {planned_start: new Date(stored.planned_start)}},
    ])('does not recalculate for $scenario', async ({changes}) => {
      await patchTask('T1', changes);

      expect(recalculateLinen).not.toHaveBeenCalled();
    });
  });

  describe('task status', () => {
    it.each(['Pending', 'In Progress', 'Paused'] as const)('recalculates a task that is %s', async (status) => {
      vi.mocked(findTask).mockResolvedValue(createTaskData({status}));

      await patchTask('T1', {planned_start: LATER});

      expect(recalculateLinen).toHaveBeenCalledOnce();
    });

    it.each(['Completed', 'Cancelled'] as const)('saves but does not recalculate a task that is %s', async (status) => {
      vi.mocked(findTask).mockResolvedValue(createTaskData({status}));

      await patchTask('T1', {planned_start: LATER});

      expect(updateTask).toHaveBeenCalledWith(db, expect.objectContaining({status, planned_start: LATER}));
      expect(recalculateLinen).not.toHaveBeenCalled();
    });

    it('does not recalculate when closing and changing the date together', async () => {
      await patchTask('T1', {status: 'Completed', planned_start: LATER});

      expect(recalculateLinen).not.toHaveBeenCalled();
    });

    it('recalculates when reopening and changing the date together', async () => {
      vi.mocked(findTask).mockResolvedValue(createTaskData({status: 'Completed'}));

      await patchTask('T1', {status: 'Pending', planned_start: LATER});

      expect(recalculateLinen).toHaveBeenCalledOnce();
    });

    it('does not recalculate when only reopening', async () => {
      vi.mocked(findTask).mockResolvedValue(createTaskData({status: 'Completed'}));

      await patchTask('T1', {status: 'Pending'});

      expect(recalculateLinen).not.toHaveBeenCalled();
    });
  });
});

describe('recalculateOpenMainCleaningTasks', () => {
  it("recalculates each of the reservation's open tasks with the event details", async () => {
    const first = createTaskData({task_id: 'T1'});
    const second = createTaskData({task_id: 'T2'});
    vi.mocked(findOpenMainCleaningTasks).mockResolvedValue([first, second]);

    await recalculateOpenMainCleaningTasks(db, 'R1', 'E1', 'Reason');

    expect(findOpenMainCleaningTasks).toHaveBeenCalledWith(db, 'R1');
    expect(vi.mocked(recalculateLinen).mock.calls).toEqual([
      [db, first, 'E1', 'Reason'],
      [db, second, 'E1', 'Reason'],
    ]);
  });

  it('does nothing when there are no open tasks', async () => {
    vi.mocked(findOpenMainCleaningTasks).mockResolvedValue([]);

    await recalculateOpenMainCleaningTasks(db, 'R1', 'E1', 'Reason');

    expect(recalculateLinen).not.toHaveBeenCalled();
  });
});
