// Postgres unique_violation — thrown by postgres.js as an error with this
// `code`. Used to translate a race-lost unique-constraint insert/update into
// a domain ConflictError instead of a raw 500.
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
  );
}
