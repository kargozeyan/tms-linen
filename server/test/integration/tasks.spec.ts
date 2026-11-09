import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {pool} from '../../src/db/pool';
import {seed} from '../../src/scripts/seed';
import {toQuantities} from './support/fixtures';
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
const NEW_TASK = {
  task_id: 'T-NEW',
  task_type: 'Main Cleaning',
  listing_id: 'L-S5',
  reservation_id: 'R-S5-A',
  planned_start: '2026-03-10T10:00:00Z',
};

describe('GET /tasks', () => {
  it('returns all tasks with their linen or null', async () => {
    const {status, body} = await api.getTasks();

    expect(status).toBe(200);
    expect(body).toHaveLength(28);
    expect(body.filter((task: any) => task.linen === null)).toHaveLength(2);
  });

  it('orders by latest planned_start first, then task_id', async () => {
    const {body} = await api.getTasks();
    const starts = body.map((task: any) => task.planned_start);
    const sameStartIds = body
      .filter((task: any) => task.planned_start === '2026-03-10T10:00:00.000Z')
      .map((task: any) => task.task_id);

    expect(starts).toEqual(starts.toSorted().toReversed());
    expect(sameStartIds).toEqual(sameStartIds.toSorted());
  });
});

describe('GET /tasks/:id', () => {
  it('returns the task with its linen', async () => {
    const {status, body} = await api.getTask('T-G04');

    expect(status).toBe(200);
    expect(body).toMatchObject({
      task_id: 'T-G04',
      planned_start: '2026-03-10T10:00:00.000Z',
      linen: {task_id: 'T-G04', sheets: 3, towels: 6, requested_sofabed: true},
    });
  });

  it('returns the same task as the list', async () => {
    const {body: tasks} = await api.getTasks();
    const {body: task} = await api.getTask('T-G04');

    expect(tasks.find(({task_id}: any) => task_id === 'T-G04')).toEqual(task);
  });

  it('keeps the task fields when there is no linen', async () => {
    const {status, body} = await api.getTask('T-X-DEEP');

    expect(status).toBe(200);
    expect(body).toMatchObject({task_id: 'T-X-DEEP', listing_id: 'L-S1', linen: null});
  });

  it('returns 404 for an unknown task', async () => {
    const {status, body} = await api.getTask('T-UNKNOWN');

    expect([status, body]).toEqual([404, {error: 'Task T-UNKNOWN not found'}]);
  });
});

describe('GET /tasks/:id/linen/history', () => {
  it('returns an empty list for a task with no recalculations', async () => {
    const {status, body} = await api.getTaskHistory('T-G01');

    expect([status, body]).toEqual([200, []]);
  });

  it('returns the latest recalculation first, with its reason and values', async () => {
    await api.sendEvents('E-201', 'E-202');

    const {body: history} = await api.getTaskHistory('T-S2-A');
    const [latest, earlier] = history;

    expect(latest).toMatchObject({
      event_id: 'E-202',
      reason: 'Reservation.CustomFields.Updated R-S2-B: number_of_guests_override',
    });
    expect(earlier).toMatchObject({
      event_id: 'E-201',
      reason: 'Reservation.CustomFields.Updated R-S2-B: requested_sofabed',
      old_values: {towels: 4},
      new_values: {towels: 6},
    });
    expect(earlier.new_values).toEqual(latest.old_values);
    expect(earlier.new_values).not.toHaveProperty('task_id');
  });

  it('returns 404 for an unknown task', async () => {
    const {status, body} = await api.getTaskHistory('T-UNKNOWN');

    expect([status, body]).toEqual([404, {error: 'Task T-UNKNOWN not found'}]);
  });
});

describe('POST /tasks', () => {
  it('stores the task with defaults, linen and a history row', async () => {
    const {status, body} = await api.createTask(NEW_TASK);

    expect(status).toBe(201);
    expect(body).toMatchObject({task_id: 'T-NEW', status: 'Pending'});

    const {body: stored} = await api.getTask('T-NEW');
    expect(stored).toMatchObject({status: 'Pending', planned_start: '2026-03-10T10:00:00.000Z'});
    expect(toQuantities(stored.linen)).toEqual(DEFAULT);
    const {body: history} = await api.getTaskHistory('T-NEW');
    expect(history).toMatchObject([
      {reason: 'Task created', event_id: null, old_values: null, new_values: {towels: 4}},
    ]);
  });

  it('rejects an existing task_id and keeps the original', async () => {
    await api.createTask(NEW_TASK);

    const {status} = await api.createTask({...NEW_TASK, planned_start: '2026-03-12T10:00:00Z'});

    expect(status).toBe(409);
    const {body: stored} = await api.getTask('T-NEW');
    const {body: history} = await api.getTaskHistory('T-NEW');
    expect(stored.planned_start).toBe('2026-03-10T10:00:00.000Z');
    expect(history).toHaveLength(1);
  });

  it('calculates linen for a task created as Completed', async () => {
    await api.createTask({...NEW_TASK, status: 'Completed'});

    const {body: stored} = await api.getTask('T-NEW');
    expect(toQuantities(stored.linen)).toEqual(DEFAULT);
  });

  it.each([
    {scenario: 'a task that is not Main Cleaning', overrides: {task_type: 'Deep Cleaning'}},
    {scenario: 'no listing_id', overrides: {listing_id: null}},
    {scenario: 'no reservation_id', overrides: {reservation_id: null}},
    {scenario: 'an unknown listing_id', overrides: {listing_id: 'L-UNKNOWN'}},
    {scenario: 'an unknown reservation_id', overrides: {reservation_id: 'R-UNKNOWN'}},
  ])('accepts $scenario with no linen or history', async ({overrides}) => {
    const {status} = await api.createTask({...NEW_TASK, ...overrides});

    expect(status).toBe(201);
    const {body: stored} = await api.getTask('T-NEW');
    const {body: history} = await api.getTaskHistory('T-NEW');
    expect(stored.linen).toBeNull();
    expect(history).toEqual([]);
  });

  it('rejects an invalid body with 400 and stores nothing', async () => {
    const {status} = await api.createTask({...NEW_TASK, planned_start: 'tomorrow'});

    expect(status).toBe(400);
    expect((await api.getTask('T-NEW')).status).toBe(404);
  });
});

describe('PATCH /tasks/:id', () => {
  it('saves the change and returns the task', async () => {
    const {status, body} = await api.updateTask('T-S5-A', {status: 'Paused'});

    expect(status).toBe(200);
    expect(body).toMatchObject({task_id: 'T-S5-A', status: 'Paused'});
    const {body: stored} = await api.getTask('T-S5-A');
    expect(stored.status).toBe('Paused');
  });

  it('keeps fields that were not sent', async () => {
    await api.updateTask('T-S5-A', {status: 'In Progress'});

    await api.updateTask('T-S5-A', {planned_start: '2026-03-12T10:00:00Z'});

    const {body: stored} = await api.getTask('T-S5-A');
    expect(stored).toMatchObject({
      status: 'In Progress',
      listing_id: 'L-S5',
      planned_start: '2026-03-12T10:00:00.000Z',
    });
  });

  it('does not change the task_id', async () => {
    const {body} = await api.updateTask('T-S5-A', {task_id: 'T-OTHER'});

    expect(body.task_id).toBe('T-S5-A');
    expect((await api.getTask('T-OTHER')).status).toBe(404);
  });

  it('treats the same moment in another timezone as no change', async () => {
    await api.updateTask('T-S5-A', {planned_start: '2026-03-10T14:00:00+04:00'});

    const {body: history} = await api.getTaskHistory('T-S5-A');
    expect(history).toEqual([]);
  });

  it('saves the date of a Completed task but keeps its linen', async () => {
    const {body: before} = await api.getTask('T-S8-A');

    await api.updateTask('T-S8-A', {planned_start: '2026-03-12T10:00:00Z'});

    const {body: after} = await api.getTask('T-S8-A');
    const {body: history} = await api.getTaskHistory('T-S8-A');
    expect(after.planned_start).toBe('2026-03-12T10:00:00.000Z');
    expect(after.linen).toEqual(before.linen);
    expect(history).toEqual([]);
  });

  it.each([
    {scenario: 'removing the reservation', remove: {reservation_id: null}, restore: {reservation_id: 'R-S5-A'}},
    {scenario: 'an unknown reservation', remove: {reservation_id: 'R-UNKNOWN'}, restore: {reservation_id: 'R-S5-A'}},
    {scenario: 'removing the listing', remove: {listing_id: null}, restore: {listing_id: 'L-S5'}},
    {scenario: 'an unknown listing', remove: {listing_id: 'L-UNKNOWN'}, restore: {listing_id: 'L-S5'}},
    {
      scenario: 'changing the task type',
      remove: {task_type: 'Deep Cleaning'},
      restore: {task_type: 'Main Cleaning'},
    },
  ])('$scenario deletes the linen, and restoring it brings it back', async ({remove, restore}) => {
    await api.updateTask('T-S5-A', remove);

    const {body: removed} = await api.getTask('T-S5-A');
    const {body: removedHistory} = await api.getTaskHistory('T-S5-A');
    expect(removed.linen).toBeNull();
    expect(removedHistory).toMatchObject([{old_values: {towels: 4}, new_values: null}]);

    await api.updateTask('T-S5-A', restore);

    const {body: restored} = await api.getTask('T-S5-A');
    const {body: restoredHistory} = await api.getTaskHistory('T-S5-A');
    expect(toQuantities(restored.linen)).toEqual(DEFAULT);
    expect(restoredHistory[0]).toMatchObject({old_values: null, new_values: {towels: 4}});
  });

  it.each([
    {scenario: 'an unknown task', taskId: 'T-UNKNOWN', changes: {status: 'Paused'}, expectedStatus: 404},
    {scenario: 'an unknown status', taskId: 'T-S5-A', changes: {status: 'Done'}, expectedStatus: 400},
    {scenario: 'a null planned_start', taskId: 'T-S5-A', changes: {planned_start: null}, expectedStatus: 400},
  ])('rejects $scenario', async ({taskId, changes, expectedStatus}) => {
    expect((await api.updateTask(taskId, changes)).status).toBe(expectedStatus);
  });
});
