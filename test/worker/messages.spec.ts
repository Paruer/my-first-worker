import { applyD1Migrations, reset } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { assert, beforeEach, expect, it } from 'vitest';
import { messageStore, messages } from '../../src/infrastructure/messages';
import type { MessageData } from '../../src/domain/message';

beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

it('starts with an empty messages table', async () => {
  expect(await drizzle(env.DB).select().from(messages)).toEqual([]);
});

it('reads the requested message and decodes its JSON data', async () => {
  const db = drizzle(env.DB);
  await db.insert(messages).values([
    { id: 1, data: { from: 'Pilot', message: 'Ready for departure.' } },
    { id: 2, data: { from: 'Tower', message: 'Clear for launch.' } },
  ]);

  const row = await db.select().from(messages).where(eq(messages.id, 2)).get();
  expect(row).toEqual({ id: 2, data: { from: 'Tower', message: 'Clear for launch.' } });
});

it('retrieves a newly created message by its generated ID', async () => {
  const store = messageStore(env.DB);
  const input: MessageData = { from: 'Navigator', message: 'Course plotted.' };
  const created = await store.create(input);

  const found = await store.find(created);

  expect(created.id).toEqual(expect.any(Number));
  assert.isDefined(found);
  expect(found.id).toBe(created.id);
  expect(found.data).toEqual(input);
});
