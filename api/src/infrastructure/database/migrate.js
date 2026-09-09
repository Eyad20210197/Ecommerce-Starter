import { fileURLToPath } from 'node:url';
import { Umzug, SequelizeStorage } from 'umzug';
import { readDatabaseEnv } from '../../config/env.js';
import { createDatabase } from './connection.js';

export async function migrate(database, logger = console) {
  if (database.options.pool.max < 2) throw new Error('Migration runner requires DB_POOL_MAX >= 2');
  const runner = new Umzug({
    migrations: { glob: ['*.js', { cwd: fileURLToPath(new URL('../../../migrations/', import.meta.url)) }] },
    context: database.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize: database }), logger,
  });
  // Hold a dedicated advisory lock across all migration transactions.
  const lock = await database.connectionManager.getConnection({ type: 'write' });
  try {
    await lock.query("SELECT pg_advisory_lock(720260909)");
    await runner.up();
  } finally {
    await lock.query("SELECT pg_advisory_unlock(720260909)");
    await database.connectionManager.releaseConnection(lock);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const database = createDatabase(readDatabaseEnv());
  try { await database.authenticate(); await migrate(database); }
  finally { await database.close(); }
}
