import {describe, expect, it} from 'vitest';
import {taskSchema, updateTaskSchema} from '../../../src/modules/tasks/task.schemas';

const validTask = {
  task_id: 'T1',
  task_type: 'Main Cleaning',
  status: 'Pending',
  listing_id: 'L1',
  reservation_id: 'R1',
  planned_start: '2026-03-10T10:00:00Z',
};

describe('taskSchema', () => {
  it('converts planned_start to a date', () => {
    expect(taskSchema.parse(validTask).planned_start).toEqual(new Date('2026-03-10T10:00:00Z'));
  });

  it('defaults the status, listing_id and reservation_id', () => {
    const task = taskSchema.parse({task_id: 'T1', task_type: 'Main Cleaning', planned_start: validTask.planned_start});

    expect(task).toMatchObject({status: 'Pending', listing_id: null, reservation_id: null});
  });

  it.each(['Pending', 'In Progress', 'Paused', 'Completed', 'Cancelled'])('accepts the status %s', (status) => {
    expect(taskSchema.safeParse({...validTask, status}).success).toBe(true);
  });

  it.each([
    {scenario: 'a missing task_id', task: {...validTask, task_id: undefined}},
    {scenario: 'a missing task_type', task: {...validTask, task_type: undefined}},
    {scenario: 'a missing planned_start', task: {...validTask, planned_start: undefined}},
    {scenario: 'an unknown status', task: {...validTask, status: 'Done'}},
    {scenario: 'an invalid planned_start', task: {...validTask, planned_start: 'tomorrow'}},
    {scenario: 'an empty listing_id', task: {...validTask, listing_id: ''}},
  ])('rejects $scenario', ({task}) => {
    expect(taskSchema.safeParse(task).success).toBe(false);
  });
});

describe('updateTaskSchema', () => {
  it('adds no defaults, so unsent fields stay unchanged', () => {
    expect(updateTaskSchema.parse({})).toEqual({});
  });

  it('keeps only the fields that were sent', () => {
    const changes = updateTaskSchema.parse({planned_start: '2026-03-12T10:00:00Z'});

    expect(changes).toEqual({planned_start: new Date('2026-03-12T10:00:00Z')});
  });

  it('allows clearing listing_id and reservation_id', () => {
    const changes = updateTaskSchema.parse({listing_id: null, reservation_id: null});

    expect(changes).toEqual({listing_id: null, reservation_id: null});
  });

  it('ignores task_id', () => {
    expect(updateTaskSchema.parse({task_id: 'T2'})).toEqual({});
  });

  it.each([
    {scenario: 'an unknown status', changes: {status: 'Done'}},
    {scenario: 'a null status', changes: {status: null}},
    {scenario: 'a null planned_start', changes: {planned_start: null}},
    {scenario: 'a null task_type', changes: {task_type: null}},
    {scenario: 'an empty task_type', changes: {task_type: ''}},
    {scenario: 'an empty listing_id', changes: {listing_id: ''}},
  ])('rejects $scenario', ({changes}) => {
    expect(updateTaskSchema.safeParse(changes).success).toBe(false);
  });
});
