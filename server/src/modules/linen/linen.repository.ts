import type {DB} from '../../db/connection';
import type {TaskLinen} from './linen.calculator';

const INSERT_QUERY = `
    INSERT INTO task_linen (task_id, sheets, towels, bathmats, handtowels, dishtowels, prepared_for_guests,
                            requested_sofabeds_count, actual_guests, infants, number_of_guests_override,
                            requested_sofabed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export async function insertLinen(db: DB, taskId: string, linen: TaskLinen) {
  await db.query(INSERT_QUERY, [
    taskId,
    linen.sheets,
    linen.towels,
    linen.bathmats,
    linen.handtowels,
    linen.dishtowels,
    linen.prepared_for_guests,
    linen.requested_sofabeds_count,
    linen.actual_guests,
    linen.infants,
    linen.number_of_guests_override,
    linen.requested_sofabed,
  ]);
}
