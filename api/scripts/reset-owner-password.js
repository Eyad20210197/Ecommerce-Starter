import { readDatabaseEnv } from '../src/config/env.js';
import { createDatabase } from '../src/infrastructure/database/connection.js';
import { createStore } from '../src/shared/db.js';
import { hashPassword } from '../src/shared/security.js';
import { z } from 'zod';

const input = z.object({
  OWNER_EMAIL: z.string().email().optional().transform(v => v ? v.toLowerCase() : undefined),
  OWNER_PASSWORD: z.string().min(16, 'OWNER_PASSWORD must be at least 16 characters long').max(128),
}).safeParse(process.env);

if (!input.success) {
  const issues = input.error.issues.map(i => i.message).join('; ');
  console.error(`Validation error: ${issues}`);
  console.error('Usage: Set OWNER_PASSWORD (16+ chars) and optionally OWNER_EMAIL before running this script.');
  process.exit(1);
}

const database = createDatabase(readDatabaseEnv());
try {
  const store = createStore(database);
  const hash = await hashPassword(input.data.OWNER_PASSWORD);

  await store.tx(async transaction => {
    let owner;
    if (input.data.OWNER_EMAIL) {
      owner = await store.one("SELECT id, email, name FROM users WHERE role='owner' AND email=$email", { email: input.data.OWNER_EMAIL }, transaction);
    } else {
      owner = await store.one("SELECT id, email, name FROM users WHERE role='owner' ORDER BY created_at ASC LIMIT 1", {}, transaction);
    }

    if (!owner) {
      throw new Error(input.data.OWNER_EMAIL ? `No owner found with email ${input.data.OWNER_EMAIL}` : 'No owner account found in database.');
    }

    await store.one('UPDATE users SET password_hash=$hash WHERE id=$id RETURNING id', { id: owner.id, hash }, transaction);
    await store.rows('DELETE FROM sessions WHERE user_id=$id RETURNING id', { id: owner.id }, transaction);
    await store.audit(owner.id, 'owner.password_reset', 'user', owner.id, {}, transaction);

    console.log(`Successfully reset password for owner account (${owner.name} <${owner.email}>).`);
    console.log('Remember to remove OWNER_PASSWORD from your environment / shell history.');
  });
} catch (error) {
  console.error(`Failed to reset password: ${error.message}`);
  process.exit(1);
} finally {
  await database.close();
}
