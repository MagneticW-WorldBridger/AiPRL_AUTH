import { SQL } from 'bun';

const client = new SQL(process.env.DATABASE_URL!);

try {
  console.log('Connecting to database...');

  // Check public tables
  const result = await client`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `;
  console.log('Tables found in public schema:', result.map(r => r.table_name));

  // Check auth table specifically
  try {
    const authTest = await client`SELECT * FROM auth LIMIT 1`;
    console.log('Auth table exists. Rows:', authTest.length);
  } catch (err) {
    console.error('Error querying auth table:', err);
  }

} catch (e) {
  console.error('Failed to connect or query database:', e);
}
