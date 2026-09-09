import { readDatabaseEnv } from '../src/config/env.js';
import { createDatabase } from '../src/infrastructure/database/connection.js';
import { createStore } from '../src/shared/db.js';
import { hashPassword } from '../src/shared/security.js';

const database = createDatabase(readDatabaseEnv());
try {
  const store = createStore(database);
  const hash = await hashPassword('password123456');
  await store.tx(async transaction => {
    const existing = await store.one("SELECT id FROM users WHERE email='loai@aurastore.com'", {}, transaction);
    if (existing) {
      await store.rows("UPDATE users SET password_hash=$hash, role='warehouse', active=true WHERE email='loai@aurastore.com'", { hash }, transaction);
      console.log('Updated existing user loai@aurastore.com to warehouse role.');
    } else {
      await store.one("INSERT INTO users(name,email,password_hash,role) VALUES('Loai','loai@aurastore.com',$hash,'warehouse') RETURNING id", { hash }, transaction);
      console.log('Created warehouse user loai@aurastore.com.');
    }
  });
} finally {
  await database.close();
}
