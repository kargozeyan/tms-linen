import mysql from 'mysql2/promise';
import {connectionOptions} from '../config/db';

export const pool = mysql.createPool({...connectionOptions, connectionLimit: 10});
