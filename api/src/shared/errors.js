export class AppError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function requireThat(condition, status, code, message) {
  if (!condition) throw new AppError(status, code, message);
}
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) throw new AppError(400, 'VALIDATION_ERROR', result.error.issues.map(issue => `${issue.path.join('.') || 'Request'}: ${issue.message}`).join('; '));
  return result.data;
}
