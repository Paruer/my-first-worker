import { applyD1Migrations, env, reset } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { beforeEach, expect, it } from 'vitest';
import { messages } from '../../src/infrastructure/messages';

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
