import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { JsonRecord } from './base';
import type { MessageData } from '../domain/message';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  data: text('data', { mode: 'json' }).$type<MessageData>().notNull(),
});

export type MessageRecord = JsonRecord<MessageData>;

export function messageStore(binding: D1Database) {
  const db = drizzle(binding);

  return {
    async create(data: MessageData): Promise<MessageRecord> {
      const [record] = await db.insert(messages).values({ data }).returning();
      return record;
    },

    async find(record: MessageRecord): Promise<MessageRecord | undefined> {
      return db.select().from(messages).where(eq(messages.id, record.id)).get();
    },
  };
}
