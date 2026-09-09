export async function up({ context }) {
  await context.sequelize.transaction(async transaction => {
    await context.sequelize.query(`
      CREATE TABLE product_images (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        url text NOT NULL CHECK (url ~ '^https://'),
        alt text NOT NULL DEFAULT '',
        position integer NOT NULL CHECK (position >= 0),
        is_primary boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(product_id, position)
      );
      CREATE INDEX product_images_product_position_idx ON product_images(product_id, position);
      CREATE UNIQUE INDEX product_images_one_primary_idx ON product_images(product_id) WHERE is_primary;
      INSERT INTO product_images(product_id, url, alt, position, is_primary)
        SELECT id, image_url, name, 0, true FROM products WHERE image_url <> '';
    `, { transaction });
  });
}

export async function down() {
  throw new Error('Forward-only migration.');
}
