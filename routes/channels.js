import express from 'express';
import { db, schema } from '../db/db.js'; // Import Drizzle db and schema
import { sql, asc, count, ilike, eq, and, or, like, inArray } from 'drizzle-orm'; // Import Drizzle functions & inArray

const router = express.Router();

// GET /api/channels
router.get('/', async (req, res, next) => {
    // Validate and sanitize query parameters
    const group = req.query.group ? String(req.query.group).trim() : undefined; // Now filters on cleaned groupTitle
    const search = req.query.search ? String(req.query.search).trim() : undefined;
    const locationCodesParam = req.query.languageGroupPrefixes ? String(req.query.languageGroupPrefixes).trim() : undefined; // Renamed for clarity
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Default limit 50
    const offset = (page - 1) * limit;

    // Ensure limit and page are positive
    if (limit <= 0 || page <= 0) {
        return res.status(400).json({ message: 'Page and limit must be positive integers.' });
    }

    try {
        // Build conditions array for filtering
        let conditions = [];
        // Add exact group title filter (now checks cleaned title)
        if (group) {
            conditions.push(eq(schema.channels.groupTitle, group));
        }
        if (search) {
            // Use ILIKE for case-insensitive partial matching
            conditions.push(ilike(schema.channels.name, `%${search}%`));
        }

        // Add location code filtering
        if (locationCodesParam) {
            const codes = locationCodesParam.split(',').map(p => p.trim().toUpperCase()).filter(p => p);
            if (codes.length > 0) {
                // Use inArray for efficient filtering on the locationCode column
                conditions.push(inArray(schema.channels.locationCode, codes));
            }
        }

        // Construct the final where clause for Drizzle
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Query for channels with filtering, ordering, and pagination
        const channelsQuery = db.select({
                id: schema.channels.id,
                name: schema.channels.name,
                groupTitle: schema.channels.groupTitle,
                tvgId: schema.channels.tvgId,
                tvgLogo: schema.channels.tvgLogo,
                url: schema.channels.url
            })
            .from(schema.channels)
            .where(whereClause)
            .orderBy(asc(schema.channels.name)) // Order by name ascending
            .limit(limit)
            .offset(offset);

        // Query for the total count matching the filters
        const countQuery = db.select({ value: count() })
                             .from(schema.channels)
                             .where(whereClause);

        // Execute both queries in parallel
        const [channelsResult, countResult] = await Promise.all([
            channelsQuery,
            countQuery
        ]);

        const totalChannels = countResult[0].value;
        const totalPages = Math.ceil(totalChannels / limit);

        res.json({
            data: channelsResult,
            pagination: {
                totalItems: totalChannels,
                totalPages: totalPages,
                currentPage: page,
                pageSize: limit
            }
        });

    } catch (err) {
        console.error('Error fetching channels:', err);
        next(err); // Pass error to the global error handler
    }
});

// GET /api/channels/groups - Get distinct group titles (now fetches cleaned titles)
router.get('/groups', async (req, res, next) => {
    try {
        const result = await db.selectDistinct({ groupTitle: schema.channels.groupTitle })
                               .from(schema.channels)
                               .where(sql`${schema.channels.groupTitle} IS NOT NULL AND ${schema.channels.groupTitle} != ''`)
                               .orderBy(asc(schema.channels.groupTitle));

        res.json(result.map(row => row.groupTitle));
    } catch (err) {
        console.error('Error fetching groups:', err);
        next(err);
    }
});

// GET /api/channels/:id - Get details for a single channel
router.get('/:id', async (req, res, next) => {
    const channelId = parseInt(req.params.id);
    if (isNaN(channelId)) {
        return res.status(400).json({ message: 'Invalid Channel ID format.' });
    }

    try {
        const result = await db.select()
                               .from(schema.channels)
                               .where(eq(schema.channels.id, channelId))
                               .limit(1);

        if (result.length === 0) {
            return res.status(404).json({ message: 'Channel not found.' });
        }
        res.json(result[0]); // Return the single channel object
    } catch (err) {
        console.error(`Error fetching channel ID ${channelId}:`, err);
        next(err);
    }
});

export default router; // Use ES module export 