import { readFileSync } from 'node:fs';
import { Sequelize } from 'sequelize';

export function sslOptions(config) {
  return config.DB_SSL ? { rejectUnauthorized: true, ...(config.DB_CA_FILE ? { ca: readFileSync(config.DB_CA_FILE, 'utf8') } : {}) } : undefined;
}
export function createDatabase(config) {
  return new Sequelize(config.DATABASE_URL, {
    dialect: 'postgres', logging: false,
    dialectOptions: { ssl: sslOptions(config), connectionTimeoutMillis: 10000, statement_timeout: 15000, idle_in_transaction_session_timeout: 20000 },
    pool: { max: config.DB_POOL_MAX, min: 0, acquire: 10000, idle: 10000 },
    define: { underscored: true }, retry: { max: 0 },
  });
}
