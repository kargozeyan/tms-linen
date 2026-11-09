import listingsJson from '../../../data/listings.json' with {type: 'json'};
import reservationsJson from '../../../data/reservations.json' with {type: 'json'};
import tasksJson from '../../../data/tasks.json' with {type: 'json'};
import {readFileSync} from 'node:fs';
import {listingSchema} from '../modules/listings/listing.schemas';
import {z} from 'zod';
import {reservationSchema} from '../modules/reservations/reservation.schemas';
import {taskSchema} from '../modules/tasks/task.schemas';
import {withTransaction} from '../db/transaction';
import {insertListing} from '../modules/listings/listing.repository';
import {insertReservation} from '../modules/reservations/reservation.repository';
import {insertTask} from '../modules/tasks/task.repository';
import {computeLinen} from '../modules/linen/linen.service';
import {insertLinen} from '../modules/linen/linen.repository';
import {connectionWithMultiStatement, type DB} from '../db/connection';

export async function seed() {
  const listings = parseData(listingsJson, listingSchema);
  const reservations = parseData(reservationsJson, reservationSchema);
  const tasks = parseData(tasksJson, taskSchema);

  const db = await connectionWithMultiStatement();
  try {
    await resetSchema(db);

    await withTransaction(db, async (tx) => {
      for (const listing of listings) await insertListing(tx, listing);
      for (const reservation of reservations) await insertReservation(tx, reservation);
      for (const task of tasks) await insertTask(tx, task);

      for (const task of tasks) {
        const linen = await computeLinen(tx, task);
        if (linen) {
          await insertLinen(tx, task.task_id, linen);
        }
      }
    });

    console.log(`Seeded ${listings.length} listings, ${reservations.length} reservations, ${tasks.length} tasks`);
  } finally {
    await db.end();
  }
}

function parseData<S extends z.ZodType>(data: unknown, schema: S) {
  const result = z.array(schema).safeParse(data);
  if (!result.success) {
    throw new Error(`Failed to parse data:${z.prettifyError(result.error)}`);
  }
  return result.data;
}

async function resetSchema(db: DB) {
  const schemaUrl = new URL('../../db/schema.sql', import.meta.url);
  const schemaSql = readFileSync(schemaUrl, 'utf8');
  await db.query(schemaSql);
}

if (import.meta.main) {
  await seed();
}
