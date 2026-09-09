export async function up({ context }) {
  await context.sequelize.transaction(async transaction => {
    await context.sequelize.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE CHECK (email = lower(email)),
        password_hash text NOT NULL, name text NOT NULL, phone text NOT NULL DEFAULT '',
        role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','owner','manager','warehouse')),
        active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text NOT NULL UNIQUE, csrf_token text NOT NULL,
        user_id uuid REFERENCES users(id), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
      CREATE TABLE rate_limits (key text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
      CREATE TABLE addresses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
        label text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, slug text NOT NULL UNIQUE,
        translations jsonb NOT NULL DEFAULT '{}'
      );
      CREATE TABLE products (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku text NOT NULL UNIQUE,
        name text NOT NULL, description text NOT NULL DEFAULT '', price_minor integer NOT NULL CHECK (price_minor >= 0),
        category_id uuid REFERENCES categories(id), tags text[] NOT NULL DEFAULT '{}',
        image_url text NOT NULL DEFAULT '', translations jsonb NOT NULL DEFAULT '{}',
        active boolean NOT NULL DEFAULT true, serialized boolean NOT NULL DEFAULT false,
        on_hand integer NOT NULL DEFAULT 0 CHECK(on_hand >= 0),
        reserved integer NOT NULL DEFAULT 0 CHECK(reserved >= 0 AND reserved <= on_hand),
        version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX products_category_idx ON products(category_id);
      CREATE INDEX products_tags_idx ON products USING gin(tags);
      CREATE INDEX products_search_idx ON products USING gin(to_tsvector('simple',name || ' ' || description || ' ' || sku));
      CREATE TABLE carts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
        user_id uuid UNIQUE REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((session_id IS NULL) <> (user_id IS NULL))
      );
      CREATE TABLE cart_items (
        cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES products(id),
        quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100), PRIMARY KEY(cart_id,product_id)
      );
      CREATE SEQUENCE order_number_seq START 1001;
      CREATE TABLE orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        number bigint NOT NULL UNIQUE DEFAULT nextval('order_number_seq'),
        invoice_number text NOT NULL UNIQUE, user_id uuid REFERENCES users(id), guest_token_hash text,
        checkout_scope text NOT NULL, idempotency_key uuid NOT NULL, request_hash text NOT NULL,
        contact jsonb NOT NULL, address jsonb NOT NULL, seller jsonb NOT NULL,
        currency text NOT NULL, exchange_rate numeric NOT NULL, base_currency text NOT NULL,
        subtotal_minor integer NOT NULL CHECK(subtotal_minor >= 0),
        shipping_minor integer NOT NULL CHECK(shipping_minor >= 0),
        tax_minor integer NOT NULL CHECK(tax_minor >= 0),
        total_minor integer NOT NULL CHECK(total_minor = subtotal_minor + shipping_minor + tax_minor),
        status text NOT NULL DEFAULT 'placed' CHECK(status IN ('placed','preparing','dispatched','delivered','completed','cancelled','returned')),
        payment_method text NOT NULL CHECK(payment_method IN ('cod','stripe')),
        payment_status text NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','refunded','void')),
        payment_reference text, shipping_reference text, tracking_url text,
        notes text NOT NULL DEFAULT '', delivered_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(checkout_scope,idempotency_key)
      );
      CREATE INDEX orders_user_idx ON orders(user_id,created_at DESC);
      CREATE INDEX orders_status_idx ON orders(status,created_at DESC);
      CREATE TABLE order_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id),
        product_id uuid NOT NULL REFERENCES products(id), sku text NOT NULL, name text NOT NULL,
        quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),
        unit_price_minor integer NOT NULL CHECK(unit_price_minor >= 0),
        serialized boolean NOT NULL, UNIQUE(order_id,product_id)
      );
      CREATE TABLE serial_units (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), serial text NOT NULL UNIQUE,
        product_id uuid NOT NULL REFERENCES products(id),
        status text NOT NULL DEFAULT 'available' CHECK(status IN ('available','reserved','sold','quarantine','removed')),
        order_item_id uuid REFERENCES order_items(id), created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX serial_units_available_idx ON serial_units(product_id,status);
      CREATE TABLE stock_movements (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, product_id uuid NOT NULL REFERENCES products(id),
        on_hand_delta integer NOT NULL, reserved_delta integer NOT NULL,
        kind text NOT NULL CHECK(kind IN ('receipt','reserve','release','sale','return','adjustment')),
        reason text NOT NULL, order_id uuid REFERENCES orders(id), actor_id uuid REFERENCES users(id),
        serials text[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX stock_movements_product_idx ON stock_movements(product_id,id DESC);
      CREATE TABLE order_events (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id),
        actor_id uuid REFERENCES users(id), action text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE returns (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL UNIQUE REFERENCES orders(id),
        reason text NOT NULL, status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','received','refunded')),
        restocked boolean, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE payment_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id),
        kind text NOT NULL CHECK(kind IN ('collection','refund')), amount_minor integer NOT NULL CHECK(amount_minor >= 0),
        currency text NOT NULL, reference text NOT NULL, actor_id uuid REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id,kind)
      );
      CREATE TABLE webhook_events (provider text NOT NULL, event_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(provider,event_id));
      CREATE TABLE audit_events (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid REFERENCES users(id),
        action text NOT NULL, entity_type text NOT NULL, entity_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE FUNCTION reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Ledger rows are immutable'; END;
      $$;
      CREATE TRIGGER immutable_stock BEFORE UPDATE OR DELETE ON stock_movements FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
      CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
      CREATE TRIGGER immutable_payments BEFORE UPDATE OR DELETE ON payment_events FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
      CREATE TRIGGER immutable_order_events BEFORE UPDATE OR DELETE ON order_events FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
      CREATE FUNCTION notify_inventory() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN PERFORM pg_notify('inventory_changed', NEW.id::text); RETURN NEW; END;
      $$;
      CREATE TRIGGER inventory_changed AFTER INSERT OR UPDATE ON products FOR EACH ROW EXECUTE FUNCTION notify_inventory();
    `, { transaction });
  });
}
export async function down() {
  throw new Error('Commerce migration is forward-only. Restore a verified backup for disaster recovery.');
}
