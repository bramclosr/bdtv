import { defineConfig } from 'drizzle-kit';
import 'dotenv/config'; // Use dotenv/config for drizzle-kit

if (!process.env.DB_URL) {
    // Construct DB_URL from individual parts if not provided directly
    // Ensure required variables are set
    if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_HOST || !process.env.DB_DATABASE || !process.env.DB_PORT) {
        throw new Error('Database connection details (DB_USER, DB_PASSWORD, DB_HOST, DB_DATABASE, DB_PORT) or DB_URL must be set in .env');
    }
    process.env.DB_URL = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;
}

export default defineConfig({
    schema: './db/schema.js',         // Path to your schema file
    out: './drizzle',              // Directory for migrations
    dialect: 'postgresql',        // 'postgresql' | 'mysql' | 'sqlite'
    dbCredentials: {
        url: process.env.DB_URL,    // Drizzle Kit uses a connection string
    },
    // Optional: Enable verbose logging for drizzle-kit
    // verbose: true,
    // Optional: Disable strict mode for drizzle-kit (not recommended)
    // strict: false,
}); 