import 'dotenv/config'; // Load .env automatically
import { drizzle } from 'drizzle-orm/node-postgres'; // Use node-postgres adapter
import pg from 'pg'; // Import default export
const { Pool } = pg; // Destructure Pool from the default export
import * as schema from './schema.js'; // Import your schema

// Construct the connection string, prioritizing DB_URL if explicitly set
let connectionString = process.env.DB_URL;
if (!connectionString) {
    // Construct DB_URL from individual parts if not provided directly
    if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_HOST || !process.env.DB_DATABASE || !process.env.DB_PORT) {
        throw new Error('Database connection details (DB_USER, DB_PASSWORD, DB_HOST, DB_DATABASE, DB_PORT) or DB_URL must be set in .env');
    }
    connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;
}

// Create the connection pool using pg
const pool = new Pool({
    connectionString: connectionString,
    // Add other pool options if needed (e.g., max connections, ssl)
    // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, // Example SSL config
});

pool.on('connect', () => {
  console.log('Connected to the database via pg pool');
});

pool.on('error', (err) => {
  console.error('pg Pool Error:', err);
  // Decide if you want to exit the process on pool errors
  // process.exit(-1);
});

// Create the Drizzle instance using the pg Pool
const db = drizzle(pool, { schema });

console.log('Drizzle ORM initialized with node-postgres driver.');

// Export the Drizzle instance, schema, and potentially the pool if needed for direct access
export { db, schema, pool };

// We no longer need the old pool or initializeDb function
// Migrations will handle schema creation/updates. 