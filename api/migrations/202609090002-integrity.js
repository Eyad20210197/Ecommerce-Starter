export async function up({context}) {
  await context.sequelize.transaction(async transaction=>{
    await context.sequelize.query(`
      CREATE INDEX sessions_user_idx ON sessions(user_id);
      CREATE INDEX rate_limits_expiry_idx ON rate_limits(expires_at);
      CREATE UNIQUE INDEX orders_shipping_reference_unique ON orders(shipping_reference) WHERE shipping_reference IS NOT NULL;
      CREATE TABLE order_serials (
        order_item_id uuid NOT NULL REFERENCES order_items(id), serial text NOT NULL,
        PRIMARY KEY(order_item_id,serial)
      );
      INSERT INTO order_serials(order_item_id,serial)
        SELECT order_item_id,serial FROM serial_units WHERE order_item_id IS NOT NULL;
      CREATE TRIGGER immutable_order_serials BEFORE UPDATE OR DELETE ON order_serials FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
      CREATE TABLE integration_jobs (
        order_id uuid NOT NULL REFERENCES orders(id), kind text NOT NULL CHECK(kind IN ('checkout','refund','shipment')),
        payload jsonb NOT NULL, response jsonb, state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','completed','failed')),
        actor_id uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(order_id,kind)
      );
      CREATE INDEX integration_jobs_pending_idx ON integration_jobs(state,created_at);
    `,{transaction});
  });
}
export async function down(){throw new Error('Forward-only migration.');}
