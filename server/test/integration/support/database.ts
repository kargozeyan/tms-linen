import type {RowDataPacket} from 'mysql2/promise';
import {pool} from '../../../src/db/pool';

export async function query(sql: string, params: unknown[] = []) {
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows;
}
