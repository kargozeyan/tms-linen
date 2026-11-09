import {vi} from 'vitest';
import type {DB} from '../src/db/connection';

export function createFakeDb(result: unknown = []) {
  const query = vi.fn().mockResolvedValue([result]);

  return {db: {query} as unknown as DB, query};
}
