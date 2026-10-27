/**
 * BrandShield AI - Frontend API Service
 * Centralized HTTP client with robust error handling and response validation.
 */

// Respects environment variable if provided, otherwise defaults to relative path (Vite dev proxy)
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  ''
).replace(/\/+$/, '');

/**
 * Custom API Error class that retains HTTP status and categorizes failure reasons.
 */
export class ApiError extends Error {
  constructor(message, status, category = 'UNKNOWN', details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.category = category; // 'BACKEND_UNAVAILABLE' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'SERVER_ERROR' | 'INVALID_RESPONSE' | 'REQUEST_FAILED'
    this.details = details;
  }
}

/**
 * Safe fetch wrapper that:
 * 1. Differentiates network failures (backend unavailable).
 * 2. Checks HTTP response status and handles 404, 400/422, and 500+ errors.
 * 3. Verifies Content-Type before parsing JSON to prevent "Unexpected token <".
 * 4. Extracts actionable error messages from FastAPI validation details.
 */
export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  let response;

  try {
    response = await fetch(url, options);
  } catch (netErr) {
    console.error(`[API Network Error] ${options.method || 'GET'} ${endpoint}:`, netErr.message);
    const targetDesc = API_BASE_URL ? `at ${API_BASE_URL}` : 'backend server';
    throw new ApiError(
      `Backend unavailable. Unable to reach the BrandShield AI ${targetDesc}. Please check server status, network connectivity, and CORS configuration.`,
      0,
      'BACKEND_UNAVAILABLE',
      netErr
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    let errorDetail = '';
    let parsedBody = null;

    if (isJson) {
      try {
        parsedBody = await response.json();
        if (Array.isArray(parsedBody?.detail)) {
          errorDetail = parsedBody.detail.map((d) => d.msg || JSON.stringify(d)).join('; ');
        } else if (typeof parsedBody?.detail === 'string') {
          errorDetail = parsedBody.detail;
        } else if (parsedBody?.message) {
          errorDetail = parsedBody.message;
        }
      } catch (parseErr) {
        console.warn(`[API] Failed to parse error response JSON for ${endpoint}:`, parseErr);
      }
    } else {
      try {
        const rawText = await response.text();
        if (rawText && rawText.length < 200 && !rawText.trim().startsWith('<')) {
          errorDetail = rawText.trim();
        }
      } catch (_) {}
    }

    if (response.status === 404) {
      console.error(`[API Not Found 404] ${options.method || 'GET'} ${endpoint}`);
      throw new ApiError(
        errorDetail || `Endpoint not found (404): ${endpoint}`,
        404,
        'NOT_FOUND',
        parsedBody
      );
    }

    if (response.status === 422 || response.status === 400) {
      console.error(`[API Validation Error ${response.status}] ${options.method || 'GET'} ${endpoint}:`, errorDetail);
      throw new ApiError(
        `Validation error: ${errorDetail || 'Invalid request parameters'}`,
        response.status,
        'VALIDATION_ERROR',
        parsedBody
      );
    }

    if (response.status >= 500) {
      console.error(`[API Server Error ${response.status}] ${options.method || 'GET'} ${endpoint}:`, errorDetail);
      throw new ApiError(
        `Unexpected server error (${response.status}): ${errorDetail || 'Please check backend logs'}`,
        response.status,
        'SERVER_ERROR',
        parsedBody
      );
    }

    throw new ApiError(
      errorDetail || `Request failed with status ${response.status}`,
      response.status,
      'REQUEST_FAILED',
      parsedBody
    );
  }

  // Response is 2xx OK - verify Content-Type before calling .json()
  if (!isJson) {
    console.error(`[API Content-Type Error] Expected application/json from ${endpoint} but received '${contentType}'`);
    throw new ApiError(
      `Unexpected response format from server (expected JSON, received ${contentType.split(';')[0] || 'text'}). Please check API routing.`,
      response.status,
      'INVALID_RESPONSE'
    );
  }

  return await response.json();
}
