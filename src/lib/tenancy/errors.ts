export type TenancyErrorCode =
  "not_found" | "forbidden" | "validation" | "conflict";

const HTTP_STATUS: Record<TenancyErrorCode, number> = {
  not_found: 404,
  forbidden: 403,
  validation: 422,
  conflict: 409,
};

export class TenancyError extends Error {
  readonly code: TenancyErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: TenancyErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "TenancyError";
    this.code = code;
    this.status = HTTP_STATUS[code];
    this.details = details;
  }
}

export const notFound = (what: string) =>
  new TenancyError("not_found", `${what} not found.`);

export const forbidden = (message = "You do not have permission to do this.") =>
  new TenancyError("forbidden", message);

export const conflict = (message: string) =>
  new TenancyError("conflict", message);

export function isTenancyError(error: unknown): error is TenancyError {
  return error instanceof TenancyError;
}

/** True for a PostgreSQL unique-constraint violation, including wrapped ones. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (
      typeof current === "object" &&
      (current as { code?: unknown }).code === "23505"
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
