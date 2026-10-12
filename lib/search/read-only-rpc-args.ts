/**
 * PostgREST GET RPC query parameters cannot represent SQL NULL reliably.
 * Omit optional nullish arguments so PostgreSQL applies each declared
 * function default. Keep 0, false and [] because those are meaningful.
 *
 * Only use for read-only functions with defaults on omitted parameters.
 */
export function compactReadOnlyRpcArgs<T extends Record<string, unknown>>(args: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(args).filter(([, value]) => value !== null && value !== undefined),
  ) as Partial<T>
}
