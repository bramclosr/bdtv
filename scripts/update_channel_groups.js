import dotenv from 'dotenv'; // Import dotenv
dotenv.config(); // Load .env file

import { db, schema } from './db/db.js';
import { sql, eq, isNull, or } from 'drizzle-orm';

// --- Configuration for Parsing ---
const locationMappings = {
    'ESPAÑA': 'ES', 'GERMANY': 'DE', 'FRANCE': 'FR', 'ITALY': 'IT',
    'ENGLISH': 'EN', 'NORDIC': 'ND', 'TURKISH': 'TR', 'TURKSIH': 'TR',
    'ÍSLANDS': 'IS', 'HEBREW': 'IL', 'QUÉBEC': 'QC', 'POLSKA': 'PL',
    'SUOMEN': 'FI', 'SUOMI': 'FI', 'SVENSK': 'SE', 'SVENSKA': 'SE',
    'NORGE': 'NO', 'NORSK': 'NO', 'INDIA': 'IN', 'INDIAN': 'IN',
    'KOREAN': 'KO', 'KURDISH': 'KU', 'LATINO': 'LA', 'MALTA': 'MT',
    'PAKISTAN': 'PK', 'PERSIAN': 'IR', 'PHILIPPINES': 'PH', 'RUSSAIN': 'RU',
    'SOUTH AFRICA': 'ZA', 'VIDEOLAND': 'NL',
    // Add more explicit mappings here if needed
};

const worldwideKeywords = [
    'NETFLIX', 'DISNEY+', 'AMAZON PRIME', 'APPLE TV+', 'PARAMOUNT',
    'HBO MAX', 'SHOWTIME', 'UNIVERSAL', 'PEACOCK', 'DREAMWORKS',
    'MARVEL', 'STAR WARS', 'SOCCER', 'VIAPLAY', 'SKY'
];

// Regex patterns
const prefixPipeRegex = /^([A-Z]{2})\|\s*(.*)$/;
const prefixDashRegex = /^([A-Z]{2})\s+-\s+(.*)$/;
const ptBrRegex = /^PT\/BR\s*-\s*(.*)$/;
const arabicRegex = /[\u0600-\u06FF]/;
const menaRegex = /(MENA)/i;
const euRegex = /(EU)/i;
const wtPipeRegex = /^(WT)\|\s*(.*)$/;
const adultRegex = /FOR ADULTS/i; // Added check for "FOR ADULTS"

async function updateGroups() {
    console.log('Starting channel group update process with refined logic (OTHER/XXX)...');
    let updatedCount = 0;
    let processedCount = 0;
    const batchSize = 5000; // Increased batch size

    try {
        const totalResult = await db.select({ count: sql`count(*)` }).from(schema.channels);
        const totalToProcess = Number(totalResult[0]?.count) || 0;
        console.log(`Total channels to potentially process/check: ${totalToProcess}`);
        if (totalToProcess === 0) {
            console.log('No channels found.');
            return;
        }

        let offset = 0;
        while (true) {
             console.log(`Fetching batch starting from offset ${offset}...`);
             const channelsToUpdate = await db.select({
                    id: schema.channels.id,
                    groupTitle: schema.channels.groupTitle
                })
                .from(schema.channels)
                .limit(batchSize)
                .offset(offset);

            if (channelsToUpdate.length === 0) {
                console.log('No more channels found in this batch, finishing.');
                break;
            }

            console.log(`Processing batch of ${channelsToUpdate.length} channels...`);

            for (const channel of channelsToUpdate) {
                processedCount++;
                const originalTitle = channel.groupTitle || '';
                let locationCode = null; // Start as null
                let cleanedTitle = originalTitle;
                let matched = false;

                // Apply rules in order
                // Rule 1: XX|
                let match = !matched ? originalTitle.match(prefixPipeRegex) : null;
                if (match) { locationCode = match[1]; cleanedTitle = match[2].trim(); matched = true; }

                // Rule 2: XX -
                match = !matched ? originalTitle.match(prefixDashRegex) : null;
                if (match) { locationCode = match[1]; cleanedTitle = match[2].trim(); matched = true; }

                // Rule 3: Specific Name Starts
                if (!matched) {
                    for (const [name, code] of Object.entries(locationMappings)) {
                        if (originalTitle.toUpperCase().startsWith(name + ' ')) {
                            locationCode = code;
                            cleanedTitle = originalTitle.substring(name.length).trim();
                            if (cleanedTitle.startsWith('-')) { cleanedTitle = cleanedTitle.substring(1).trim(); }
                            matched = true; break;
                        }
                    }
                }

                 // Rule 4: Specific Prefixes/Keywords (PT/BR, WT|, MENA, EU)
                 match = !matched ? originalTitle.match(ptBrRegex) : null;
                 if (match) { locationCode = 'BR'; cleanedTitle = match[1].trim(); matched = true; }
                 match = !matched ? originalTitle.match(wtPipeRegex) : null;
                 if (match) { locationCode = 'WW'; cleanedTitle = match[2].trim(); matched = true; }
                 if (!matched && menaRegex.test(originalTitle)) { locationCode = 'AR'; matched = true; } // Or 'ME'
                 if (!matched && euRegex.test(originalTitle)) { locationCode = 'EU'; matched = true; }

                // Rule 5: Arabic Script
                if (!matched && arabicRegex.test(originalTitle)) { locationCode = 'AR'; cleanedTitle = originalTitle; matched = true; }

                // Rule 6: Adult Content Check
                if (!matched && adultRegex.test(originalTitle)) {
                    locationCode = 'XXX';
                    // Keep original title for XXX category? Or clean "FOR ADULTS"?
                    // cleanedTitle = originalTitle.replace(adultRegex, '').trim();
                    matched = true;
                }

                // Rule 7: Generic Worldwide Keywords (only if no code assigned yet)
                if (locationCode === null) {
                     for (const keyword of worldwideKeywords) {
                         if (originalTitle.toUpperCase().includes(keyword)) {
                             locationCode = 'WW'; break;
                         }
                     }
                }

                // Rule 8: Fallback to 'OTHER' if still null
                if (locationCode === null) {
                    locationCode = 'OTHER';
                }

                // Final check: ensure cleanedTitle is not empty
                if (locationCode !== 'AR' && locationCode !== 'OTHER' && !cleanedTitle) { // Don't reset AR/OTHER
                    cleanedTitle = originalTitle;
                }


                // Update the database row
                try {
                    await db.update(schema.channels)
                        .set({ locationCode: locationCode, cleanedGroupTitle: cleanedTitle })
                        .where(eq(schema.channels.id, channel.id));
                    updatedCount++;
                } catch (updateError) {
                    console.error(`Failed to update channel ID ${channel.id}:`, updateError);
                }
            }
            offset += channelsToUpdate.length;
            console.log(`Batch finished. Processed: ${processedCount}, Updated: ${updatedCount}`);
            await new Promise(resolve => setTimeout(resolve, 50)); // Even shorter delay for faster batches
        }

        console.log('--- Update Summary ---');
        console.log(`Total Channels Processed: ${processedCount}`);
        console.log(`Channels Updated (includes re-processing): ${updatedCount}`);
        console.log('----------------------');

    } catch (err) {
        console.error('Error during update process:', err);
        process.exit(1);
    } finally {
        console.log('Group update script finished.');
    }
}

// IMPORTANT: Review the logic and mappings above before running.
updateGroups(); // Uncommented to run
// console.log('IMPORTANT: Review the refined logic and mappings in the script before uncommenting and running `updateGroups()`.'); 