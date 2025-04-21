import fs from 'fs'; // Use ES module syntax
import path from 'path';
import url from 'url'; // Import the url module
import { Parser } from 'm3u8-parser'; // Import the new parser
import { db, schema } from '../db/db.js'; // Use ES module syntax and drizzle db instance
import { sql } from 'drizzle-orm'; // Import sql helper if needed for raw queries or functions

// --- Group Title Parsing Logic --- START
// Configuration for Parsing
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
const adultRegex = /FOR ADULTS/i;

// Helper function to parse group title and extract location code
function parseGroupTitle(originalTitle) {
    originalTitle = originalTitle || '';
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
        // cleanedTitle = originalTitle.replace(adultRegex, '').trim(); // Optional: clean title too
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

    // Final check: ensure cleanedTitle is not empty or fallback
    if (!cleanedTitle && originalTitle) {
        cleanedTitle = originalTitle; // Fallback if cleaning resulted in empty
    }
    if (!cleanedTitle) { // If original was also empty/null
        cleanedTitle = 'Uncategorized';
    }


    return { locationCode, groupTitle: cleanedTitle };
}
// --- Group Title Parsing Logic --- END

// Helper to extract attributes from #EXTINF string line
function extractAttributesFromString(line) {
    const attributes = {};
    // Match attributes like key="value" more robustly
    const regex = /([a-zA-Z0-9_-]+)=(["'])(.*?)\2/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
        // Use lower-case keys for consistency
        attributes[match[1].toLowerCase()] = match[3]; // match[3] captures content inside quotes
    }

    // Extract the name part after the last comma
    const nameMatch = line.match(/,(?!.*,)(.*)/);
    const nameAfterComma = nameMatch ? nameMatch[1].trim() : null;

    // Prioritize tvg-name, then name after comma, then Unknown
    attributes['extractedChannelName'] = attributes['tvg-name'] || nameAfterComma || 'Unknown';

    return attributes;
}

async function parseAndStoreM3u(filePath) {
    try {
        // --- Clear existing data --- 
        console.log('Clearing existing channels table...');
        await db.delete(schema.channels);
        console.log('Channels table cleared.');

        // --- Read and Parse M3U --- 
        console.log(`Reading M3U file from: ${filePath}`);
        const content = fs.readFileSync(filePath, { encoding: 'utf-8' });
        const parser = new Parser();
        parser.push(content);
        parser.end();
        const playlist = parser.manifest;

        if (!playlist.segments || playlist.segments.length === 0) {
            console.log('No segments found in the playlist.');
            return;
        }
        console.log(`Parsed ${playlist.segments.length} segments/channels from the playlist.`);

        // --- Prepare Data for Batch Insert --- 
        const channelsToInsert = [];
        let skippedCount = 0;
        console.log('Preparing channel data for batch insert...');

        for (const segment of playlist.segments) {
            let name, groupTitle, tvgId, tvgLogo;
            const url = segment.uri;

            let attributes = {};
            if (segment.inf) { 
                // Handle segment.inf if present (less likely path now)
                 attributes = extractAttributesFromString(segment.inf || ''); 
                 name = attributes['extractedChannelName'];
                 groupTitle = attributes['group-title'];
                 tvgId = attributes['tvg-id']; 
                 tvgLogo = attributes['tvg-logo'];
            } else if (segment.title) {
                 attributes = extractAttributesFromString(segment.title);
                 name = attributes['extractedChannelName']; 
                 groupTitle = attributes['group-title'];
                 tvgId = attributes['tvg-id'];
                 tvgLogo = attributes['tvg-logo'];
             } else {
                  skippedCount++;
                  continue;
             }

             // Ensure default values if attributes are missing or explicitly empty
             const originalGroupTitle = groupTitle || 'Uncategorized';
             name = name || 'Unknown';

             // Parse the original group title
             const parsedGroupInfo = parseGroupTitle(originalGroupTitle);

             // Allow tvgId and tvgLogo to be null/undefined if missing, or empty string if present but empty
             // The DB schema allows NULL for these TEXT fields

             if (!url) {
                 console.warn(`Skipping item due to missing URL: ${name}`);
                 skippedCount++;
                 continue;
             }

             channelsToInsert.push({
                name: name,
                groupTitle: parsedGroupInfo.groupTitle,
                locationCode: parsedGroupInfo.locationCode,
                tvgId: tvgId, // Will be null/undefined or string (including empty)
                tvgLogo: tvgLogo, // Will be null/undefined or string (including empty)
                url: url
             });
        }

        console.log(`Prepared ${channelsToInsert.length} channels for insertion. ${skippedCount} channels skipped due to missing data.`);

        // --- Perform Batch Inserts --- 
        const batchSize = 5000; // Insert 5000 rows at a time
        let insertedCount = 0;
        let conflictSkippedCount = 0;
        console.log(`Starting batch inserts with batch size ${batchSize}...`);

        for (let i = 0; i < channelsToInsert.length; i += batchSize) {
            const batch = channelsToInsert.slice(i, i + batchSize);
            if (batch.length === 0) continue;

            console.log(`Inserting batch ${i / batchSize + 1} of ${Math.ceil(channelsToInsert.length / batchSize)} (Size: ${batch.length})`);

            try {
                 // Using a transaction per batch might be safer for large datasets
                 await db.transaction(async (tx) => {
                    const result = await tx.insert(schema.channels)
                        .values(batch)
                        .onConflictDoNothing({ target: schema.channels.url })
                        .returning({ id: schema.channels.id }); // Use returning to count actual inserts
                    
                    const actuallyInserted = result.length;
                    const conflictsInBatch = batch.length - actuallyInserted;
                    insertedCount += actuallyInserted;
                    conflictSkippedCount += conflictsInBatch;
                 });
             } catch (batchError) {
                 console.error(`Error inserting batch starting at index ${i}:`, batchError);
                 // Decide how to handle batch errors: skip batch, stop process?
                 // Current: Log error and continue with the next batch.
                 skippedCount += batch.length; // Count the whole failed batch as skipped
             }
         }

        console.log(`----------------------------------------`);
        console.log(` M3U Parsing and Batch Storage Complete `);
        console.log(`----------------------------------------`);
        console.log(`Total Items Parsed: ${playlist.segments.length}`);
        console.log(`Initial Skipped (Missing URL/Data): ${skippedCount}`);
        console.log(`Successfully Inserted: ${insertedCount}`);
        console.log(`Skipped due to Conflict (Duplicate URL): ${conflictSkippedCount}`);
        console.log(`----------------------------------------`);

    } catch (error) {
        console.error('Error during M3U parsing and storage:', error);
        throw error;
    }
}

// --- Script Execution ---
// Use top-level await requires Node v14.8+
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) { // Use url.pathToFileURL
    (async () => {
        const args = process.argv.slice(2);
        if (args.length !== 1) {
            console.error('Usage: node scripts/parseM3u.js <path_to_m3u_file>');
            process.exit(1);
        }

        const m3uFilePath = path.resolve(args[0]); // Resolve to absolute path

        if (!fs.existsSync(m3uFilePath)) {
            console.error(`Error: M3U file not found at ${m3uFilePath}`);
            process.exit(1);
        }

        try {
            await parseAndStoreM3u(m3uFilePath);
            console.log('Script finished successfully.');
            process.exit(0);
        } catch (err) {
            console.error("Script failed with error:", err);
            process.exit(1);
        }
    })();
}

export default parseAndStoreM3u; // Export function using ES module syntax 