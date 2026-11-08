import type {RowDataPacket} from 'mysql2/promise';
import {type Listing} from './listing.schemas';
import type {DB} from '../../db/connection';

const FIND_QUERY = `SELECT * FROM listings WHERE listing_id = ?`;

const INSERT_QUERY = `INSERT INTO listings (listing_id, name, linen_attribute)
                      VALUES (?, ?, ?)`;

export async function findListing(db: DB, listingId: string) {
  const [rows] = await db.query<RowDataPacket[]>(FIND_QUERY, [listingId]);
  return rows[0] as Listing | undefined;
}

export async function insertListing(db: DB, listing: Listing) {
  await db.query(INSERT_QUERY, [listing.listing_id, listing.name, listing.linen_attribute]);
}
