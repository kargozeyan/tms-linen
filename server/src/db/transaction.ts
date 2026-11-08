import {Connection, type PoolConnection} from 'mysql2/promise';
import {pool} from './pool';

export async function withTransaction<C extends Connection, T>(
  connection: C,
  fn: (connection: C) => Promise<T>,
): Promise<T> {
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();

    return result;
  } catch (error) {
    await connection.rollback().catch((rollbackError) => console.error('Rollback failed', rollbackError));

    throw error;
  }
}

export async function withPoolTransaction<T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    return await withTransaction(connection, fn);
  } finally {
    connection.release();
  }
}
