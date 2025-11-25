import { drizzle } from 'drizzle-orm/bun-sql';
import { SQL } from 'bun';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
}

// Use Bun's native SQL client
const client = new SQL(process.env.DATABASE_URL!);

// Connect Drizzle to the Bun SQL client
export const db = drizzle(client, { schema });
