// scripts/test_db_connection.js
import dotenv from 'dotenv';
dotenv.config();

// Log relevant env vars
console.log('ENV VARS Check:');
console.log(`DB_URL: ${process.env.DB_URL}`);
console.log(`DB_HOST: ${process.env.DB_HOST}`);
console.log(`DB_DATABASE: ${process.env.DB_DATABASE}`);
console.log(`DB_USER: ${process.env.DB_USER}`);
console.log('--- End ENV VARS Check ---');

import { db, schema } from './db/db.js';
import { sql } from 'drizzle-orm';

async function testConnection() {
    console.log('Attempting to connect and count channels...');
    try {
        const result = await db.select({ count: sql`count(*)` }).from(schema.channels);
        const count = Number(result[0]?.count) || 0;
        console.log(`>>> Channel count from DB: ${count}`);
        if (count > 0) {
            console.log('>>> Successfully connected and found channels.');
        } else {
            console.error('>>> Connected but found 0 channels. Check DB content or connection details.');
        }
    } catch (err) {
        console.error('>>> Error connecting to DB or executing query:', err);
        process.exit(1);
    } finally {
         // Optional: Close pool if db setup allows/requires
         // await pool.end(); 
    }
}

testConnection(); 