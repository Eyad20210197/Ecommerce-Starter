export async function getCart(store, request, transaction) {
  const user = request.user?.id || null;
  const session = user ? null : request.session.id;
  return store.one(`INSERT INTO carts(user_id,session_id) VALUES($user,$session) ON CONFLICT (${user ? 'user_id' : 'session_id'})
    DO UPDATE SET updated_at=now() RETURNING *`, { user, session }, transaction);
}
export const cartLines = (store, id, transaction) => store.rows(`SELECT ci.quantity,p.id AS product_id,p.name,p.sku,p.price_minor,p.image_url,p.active,p.on_hand-p.reserved AS available,p.translations
  FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.cart_id=$id ORDER BY p.id`, { id }, transaction);
