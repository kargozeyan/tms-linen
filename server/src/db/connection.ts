import mysql, {type Connection, type Pool} from 'mysql2/promise';
import {connectionOptions} from '../config/db';

export type DB = Connection | Pool;

export const connectionWithMultiStatement = () => {
  return mysql.createConnection({
    ...connectionOptions,
    multipleStatements: true,
  });
};
