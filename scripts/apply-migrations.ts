import postgres from 'postgres';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL!);

async function applyMigrations() {
  try {
    console.log('Connecting to database...');
    
    // Test connection
    await sql`SELECT 1`;
    console.log('✓ Database connection successful\n');

    // Get migration files
    const migrationsDir = join(process.cwd(), 'drizzle');
    const files = await readdir(migrationsDir);
    const migrationFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort to apply in order

    if (migrationFiles.length === 0) {
      console.log('No migration files found');
      return;
    }

    console.log(`Found ${migrationFiles.length} migration(s) to apply:\n`);

    // Create drizzle schema if it doesn't exist
    await sql.unsafe('CREATE SCHEMA IF NOT EXISTS drizzle');

    // Create migrations tracking table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;

    for (const file of migrationFiles) {
      const filePath = join(migrationsDir, file);
      const content = await readFile(filePath, 'utf-8');
      
      // Check if migration already applied
      const existing = await sql`
        SELECT * FROM drizzle.__drizzle_migrations 
        WHERE hash = ${file}
      `;

      if (existing.length > 0) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`📝 Applying ${file}...`);

      // Split by statement breakpoints and execute each statement
      const statements = content
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        if (statement.trim()) {
          // Execute raw SQL
          await sql.unsafe(statement);
        }
      }

      // Record migration
      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${file}, ${Date.now()})
      `;

      console.log(`✓ Applied ${file}\n`);
    }

    console.log('✅ All migrations applied successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigrations();

