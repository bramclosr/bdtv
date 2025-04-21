import { db, schema } from '../db/db.js'; // Adjust path if your db setup is elsewhere
import { sql, asc } from 'drizzle-orm';

async function listGroups() {
    console.log('Fetching distinct group titles from database...');
    try {
        const results = await db.selectDistinct({ groupTitle: schema.channels.groupTitle })
                               .from(schema.channels)
                               .where(sql`${schema.channels.groupTitle} IS NOT NULL AND ${schema.channels.groupTitle} != ''`)
                               .orderBy(asc(schema.channels.groupTitle));

        if (results.length === 0) {
            console.log('No non-empty group titles found.');
            return;
        }

        console.log('--- Distinct Group Titles ---');
        results.forEach(row => {
            console.log(row.groupTitle);
        });
        console.log('--- End of List ---');

    } catch (err) {
        console.error('Error fetching group titles:', err);
        process.exit(1); // Exit with error code
    } finally {
        // Ensure the pool disconnects if needed (depends on your db connection setup)
        // Example: await db.pool?.end(); 
        console.log('Script finished.');
    }
}

listGroups(); 