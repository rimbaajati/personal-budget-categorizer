import { AllowedCategory } from './systemPrompt';

export interface CategorizeItemPayload {
  id: string;
  name: string;
}

export interface CategorizeItemResult {
  id: string | number;
  category: AllowedCategory;
}

export interface CategorizeSuccessResponse {
  success: true;
  results: CategorizeItemResult[];
  isFallback?: boolean;
  warning?: string;
}

export interface CategorizeErrorResponse {
  success: false;
  error: string;
}

export type CategorizeResponse =
  | CategorizeSuccessResponse
  | CategorizeErrorResponse;

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Safely parses response body as JSON.
 * Avoids crashing with "SyntaxError: Unexpected end of JSON input" on empty or invalid text.
 */
async function parseJsonSafely(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text || !text.trim()) {
      return null;
    }
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Calls /api/categorize to categorize expense items.
 * Robustly checks response.ok, parses JSON safely, and formats user-friendly error messages.
 */
export async function categorizeExpenses(
  items: CategorizeItemPayload[]
): Promise<CategorizeSuccessResponse> {
  let response: Response;

  try {
    response = await fetch('/api/categorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(
        'Waktu permintaan habis (Timeout). Silakan periksa koneksi Anda dan coba lagi.',
        408
      );
    }
    throw new ApiError(
      'Gagal terhubung ke server. Periksa koneksi internet Anda.',
      0
    );
  }

  const rawJson = (await parseJsonSafely(response)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    if (response.status === 429) {
      throw new ApiError(
        (rawJson?.error as string) ||
          'Sistem sedang sibuk (Rate limit). Silakan coba beberapa saat lagi.',
        429
      );
    }

    if (rawJson?.error && typeof rawJson.error === 'string') {
      throw new ApiError(rawJson.error, response.status);
    }

    if (response.status >= 500) {
      throw new ApiError(
        'Terjadi kendala pada server. Silakan coba beberapa saat lagi.',
        response.status
      );
    }

    throw new ApiError(
      'Permintaan tidak valid. Silakan periksa kembali data Anda.',
      response.status
    );
  }

  if (!rawJson || typeof rawJson !== 'object') {
    throw new ApiError('Format respons dari server tidak valid.', 502);
  }

  if (rawJson.success === false && typeof rawJson.error === 'string') {
    throw new ApiError(rawJson.error, response.status);
  }

  if (!Array.isArray(rawJson.results)) {
    throw new ApiError(
      'Server tidak mengembalikan daftar hasil yang valid.',
      502
    );
  }

  return {
    success: true,
    results: rawJson.results as CategorizeItemResult[],
    isFallback: Boolean(rawJson.isFallback),
    warning: typeof rawJson.warning === 'string' ? rawJson.warning : undefined,
  };
}
