import { pgTable, serial, text, timestamp, index } from 'drizzle-orm/pg-core';

export const channels = pgTable('channels', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    locationCode: text('locationCode'),
    groupTitle: text('cleanedGroupTitle'),
    tvgId: text('tvg_id'),
    tvgLogo: text('tvg_logo'),
    url: text('url').notNull().unique(),
    parsedAt: timestamp('parsed_at', { withTimezone: true }).defaultNow(),
}, (table) => {
    return {
        groupTitleIdx: index('idx_channels_group_title').on(table.groupTitle),
        nameIdx: index('idx_channels_name').on(table.name),
        // url index is created automatically due to unique constraint
    };
}); 