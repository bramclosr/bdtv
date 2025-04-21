import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg'; // Import default export
const { Pool } = pg; // Destructure Pool from the default export

// Construct the connection string (same logic as in db.js)
let connectionString = process.env.DB_URL;
if (!connectionString) {
    if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_HOST || !process.env.DB_DATABASE || !process.env.DB_PORT) {
        throw new Error('Database connection details (DB_USER, DB_PASSWORD, DB_HOST, DB_DATABASE, DB_PORT) or DB_URL must be set in .env');
    }
    connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;
}

// Migrator needs its own pool instance
const migrationPool = new Pool({ connectionString });
const migrationDb = drizzle(migrationPool);

async function runMigrations() {
    try {
        console.log('Starting database migrations...');
        await migrate(migrationDb, { migrationsFolder: 'drizzle' });
        console.log('Migrations applied successfully!');
        await migrationPool.end(); // Close the pool used for migrations
        console.log('Migration pool closed.');
        process.exit(0); // Exit cleanly
    } catch (error) {
        console.error('Error applying migrations:', error);
        await migrationPool.end(); // Ensure pool is closed on error too
        console.log('Migration pool closed (on error).');
        process.exit(1); // Exit with error
    }
}

runMigrations(); 