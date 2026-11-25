/** The only errors whose message reaches the client. Anything else becomes a generic 500. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Per-field messages for validation errors. */
    readonly fields?: Record<string, string>,
    /** Extra safe data, for example the id of an invitation whose email failed. */
    readonly details?: Record<string, string | number>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const unauthorized = () => new ApiError(401, "unauthorized", "Sign in to continue.");
export const forbidden = (code = "forbidden", message = "You do not have permission to do this.") => new ApiError(403, code, message);
/** Also used when the record belongs to another organization, so existence is not revealed. */
export const notFound = () => new ApiError(404, "not_found", "Not found.");
export const conflict = (code: string, message: string) => new ApiError(409, code, message);
export const invalid = (fields: Record<string, string>) => new ApiError(422, "validation_failed", "Check the highlighted fields.", fields);
export const versionConflict = () => conflict("version_conflict", "This record changed since you opened it. Reload and try again.");
