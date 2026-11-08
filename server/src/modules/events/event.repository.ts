import type {ResultSetHeader} from 'mysql2/promise';
import type {DB} from '../../db/connection';

const INSERT_QUERY = `INSERT IGNORE INTO processed_events (event_id) VALUES (?)`;

export async function insertProcessedEvent(db: DB, eventId: string) {
  const [result] = await db.query<ResultSetHeader>(INSERT_QUERY, [eventId]);
  return result.affectedRows === 1;
}
