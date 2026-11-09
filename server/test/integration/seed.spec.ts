import {afterAll, beforeAll, expect, it} from 'vitest';
import {pool} from '../../src/db/pool';
import {findLinen} from '../../src/modules/linen/linen.repository';
import {seed} from '../../src/scripts/seed';
import {query} from './support/database';
import {toQuantities} from './support/fixtures';

const DEFAULT = {sheets: 2, towels: 4, bathmats: 1, handtowels: 5, dishtowels: 1, sofabeds: 0};
const FIVE_GUESTS = {sheets: 3, towels: 5, bathmats: 1, handtowels: 6, dishtowels: 1, sofabeds: 1};
const THREE_GUESTS_WITH_SOFABED = {sheets: 3, towels: 6, bathmats: 1, handtowels: 7, dishtowels: 1, sofabeds: 1};

beforeAll(async () => {
  await seed();
});

afterAll(async () => {
  await pool.end();
});

it.each([
  {task: 'T-G01', expected: DEFAULT},
  {task: 'T-G02', expected: DEFAULT},
  {task: 'T-G03', expected: DEFAULT},
  {task: 'T-G04', expected: THREE_GUESTS_WITH_SOFABED},
  {task: 'T-G05', expected: FIVE_GUESTS},
  {task: 'T-G06', expected: FIVE_GUESTS},
  {task: 'T-G07', expected: {sheets: 2, towels: 2, bathmats: 1, handtowels: 3, dishtowels: 1, sofabeds: 1}},
  {task: 'T-G08', expected: {sheets: 1, towels: 2, bathmats: 0, handtowels: 0, dishtowels: 0, sofabeds: 0}},
  {task: 'T-G09', expected: {sheets: 3, towels: 6, bathmats: 2, handtowels: 8, dishtowels: 1, sofabeds: 0}},
  {task: 'T-G10', expected: FIVE_GUESTS},
])('calculates the PDF example $task', async ({task, expected}) => {
  const linen = await findLinen(pool, task);

  expect(linen && toQuantities(linen)).toEqual(expected);
});

it('gives no linen to a task that is not Main Cleaning', async () => {
  await expect(findLinen(pool, 'T-X-DEEP')).resolves.toBeNull();
});

it('gives no linen to a task whose reservation is not found', async () => {
  await expect(findLinen(pool, 'T-X-MISSING')).resolves.toBeNull();
});

it('calculates linen for a Completed Main Cleaning task', async () => {
  const linen = await findLinen(pool, 'T-S8-A');

  expect(linen && toQuantities(linen)).toEqual(DEFAULT);
});

it('writes no history or processed events', async () => {
  const [counts] = await query(
    'SELECT (SELECT COUNT(*) FROM linen_history) AS history, (SELECT COUNT(*) FROM processed_events) AS events',
  );

  expect(counts).toEqual({history: 0, events: 0});
});
