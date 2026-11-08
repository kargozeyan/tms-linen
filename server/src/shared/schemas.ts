import {z} from 'zod';

export const nonEmptyString = z.string().min(1);
export const count = z.number().int().min(0);
export const isoDate = z.iso.datetime({offset: true}).transform((value) => new Date(value));
