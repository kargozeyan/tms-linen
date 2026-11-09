import {describe, expect, it} from 'vitest';
import {insertProcessedEvent} from '../../../src/modules/events/event.repository';
import {createFakeDb} from '../../fake-db';

describe('insertProcessedEvent', () => {
  it('returns true when the event is new', async () => {
    const {db, query} = createFakeDb({affectedRows: 1});

    await expect(insertProcessedEvent(db, 'E1')).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(expect.any(String), ['E1']);
  });

  it('returns false when the event was already processed', async () => {
    const {db} = createFakeDb({affectedRows: 0});

    await expect(insertProcessedEvent(db, 'E1')).resolves.toBe(false);
  });
});
