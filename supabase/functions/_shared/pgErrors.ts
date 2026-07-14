type PostgrestLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} | null | undefined;

/**
 * True when a query failed because the table does not exist. Direct Postgres
 * reports 42P01; PostgREST (which supabase-js talks to) reports PGRST205
 * with a "Could not find the table ... in the schema cache" message.
 */
export function isMissingTableError(error: PostgrestLikeError): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;

  const message = (error.message ?? "").toLowerCase();

  return (
    (message.includes("relation") && message.includes("does not exist")) ||
    message.includes("could not find the table") ||
    (message.includes("schema cache") && message.includes("could not find"))
  );
}

/**
 * Human-readable message from any thrown value. PostgREST errors are plain
 * objects (not Error instances), so String(error) yields "[object Object]" —
 * this pulls out message/details/hint/code instead.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const maybe = error as {
      message?: unknown;
      error?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [maybe.message, maybe.error, maybe.details, maybe.hint]
      .filter((part): part is string => typeof part === "string" && part.length > 0);

    if (parts.length > 0) {
      const text = parts.join(": ");
      return typeof maybe.code === "string" && maybe.code ? `${text} (${maybe.code})` : text;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}
