type FunctionErrorContext = {
  context?: unknown;
};

function getResponseFromContext(context: unknown): Response | null {
  if (context instanceof Response) return context;

  if (context && typeof context === 'object') {
    const maybeResponse = (context as { response?: unknown }).response;
    if (maybeResponse instanceof Response) return maybeResponse;
  }

  return null;
}

function formatBody(body: unknown) {
  if (!body) return '';
  if (typeof body === 'string') return body;

  if (typeof body === 'object') {
    const maybeBody = body as { error?: unknown; message?: unknown; detail?: unknown; details?: unknown; stage?: unknown };
    const parts = [maybeBody.error, maybeBody.message, maybeBody.detail, maybeBody.details, maybeBody.stage]
      .filter(Boolean)
      .map((part) => (typeof part === 'string' ? part : JSON.stringify(part)));

    if (parts.length > 0) return parts.join(': ');
    return JSON.stringify(body);
  }

  return String(body);
}

async function readResponseBody(response: Response) {
  try {
    return await response.clone().json();
  } catch {
    try {
      return await response.clone().text();
    } catch {
      return null;
    }
  }
}

export async function getFunctionErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : String(error || 'Edge Function request failed.');
  const response = getResponseFromContext((error as FunctionErrorContext | null)?.context);

  if (!response) return fallback;

  const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
  const bodyText = formatBody(await readResponseBody(response));

  return bodyText ? `${status}: ${bodyText}` : `${status}: ${fallback}`;
}
