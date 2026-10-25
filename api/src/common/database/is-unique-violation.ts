import { QueryFailedError } from 'typeorm';

interface PostgresDriverError {
  code?: string;
  constraint?: string;
}

/**
 * Detects PostgreSQL unique violations (SQLSTATE 23505).
 * Optionally restricts the check to a specific constraint or index name.
 */
export function isUniqueViolation(
  error: unknown,
  constraint?: string,
): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as PostgresDriverError;

  if (driverError.code !== '23505') {
    return false;
  }

  return constraint === undefined || driverError.constraint === constraint;
}
