import mysql, {type Connection} from 'mysql2/promise';
import {connectionOptions} from '../config/db';

export type DB = Connection;

export const connectionWithMultiStatement = () => {
  return mysql.createConnection({
    ...connectionOptions,
    multipleStatements: true,
  });
};
