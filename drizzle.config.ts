// drizzle.config.ts (Aligned with Official Get Started Guide)
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' }); // Load .env from root

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Error: DATABASE_URL environment variable is not set.");
  console.error("Ensure you have a .env file in the project root with DATABASE_URL defined.");
  throw new Error('DATABASE_URL environment variable is required');
}

const config: Config = {
  schema: './app/src/db/schema.ts', // Path relative to this config file
  out: './drizzle',                // Output directory relative to this config file
  dialect: 'postgresql',          // Correct dialect specified
  dbCredentials: {
    url: databaseUrl,             // Correct property for connection string
  },
 // driver: 'pg', <-- REMOVED this line to match official Get Started example
  verbose: true,                  // Optional: Enable verbose logging
  strict: true,                   // Optional: Enable strict mode
};

export default config;