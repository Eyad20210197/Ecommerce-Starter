import { QueryTypes } from 'sequelize';
export function createStore(database) {
  const rows = (sql, bind = {}, transaction) => database.query(sql, { bind, type: QueryTypes.SELECT, transaction });
  const one = async (...args) => (await rows(...args))[0] ?? null;
  const tx = work => database.transaction(work);
  const audit = (actor, action, entityType, entityId, details = {}, transaction) => one(
    'INSERT INTO audit_events(actor_id, action, entity_type, entity_id, details) VALUES ($actor, $action, $type, $id, $details::jsonb) RETURNING id',
    { actor: actor || null, action, type: entityType, id: String(entityId), details: JSON.stringify(details) }, transaction);
  return { rows, one, tx, audit, database };
}
