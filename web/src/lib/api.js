/**
 * Universal API Client with automatic CSRF management and error normalization.
 */

let currentCsrf = null;

export function setCsrfToken(token) {
  currentCsrf = token;
}

export function getCsrfToken() {
  return currentCsrf;
}

export async function api(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const requestHeaders = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(currentCsrf ? { 'X-CSRF-Token': currentCsrf } : {}),
    ...headers
  };

  const response = await fetch('/api/v1' + path, {
    method,
    credentials: 'same-origin',
    headers: requestHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const error = new Error(errorData?.error?.message || 'Request failed. Please try again.');
    error.status = response.status;
    error.code = errorData?.error?.code;
    error.requestId = errorData?.error?.requestId;
    throw error;
  }

  if (raw) return response;
  if (response.status === 204) return null;
  return response.json();
}
