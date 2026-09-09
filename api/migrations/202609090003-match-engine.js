export async function up({ context }) {
  await context.sequelize.transaction(async transaction => {
    await context.sequelize.query(`
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS verified_at timestamptz;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES users(id);
      CREATE INDEX IF NOT EXISTS order_items_verification_idx ON order_items(order_id, verified);
    `, { transaction });
  });
}
export async function down() {
  throw new Error('Forward-only migration.');
}
