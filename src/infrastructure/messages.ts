import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Message } from '../domain/message';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  data: text('data', { mode: 'json' }).$type<Message>().notNull(),
});
