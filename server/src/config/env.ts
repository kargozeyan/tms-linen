import {z} from 'zod';

const schema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
});

export const env = schema.parse(process.env);
