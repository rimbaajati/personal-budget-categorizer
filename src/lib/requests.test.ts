import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { categorizeExpenses, ApiError } from './requests';

describe('categorizeExpenses client module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully returns categorized items when response is ok', async () => {
    const mockData = {
      success: true,
      results: [{ id: '1', category: 'Food & Drink' }],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockData),
    });

    const res = await categorizeExpenses([{ id: '1', name: 'Nasi padang' }]);
    expect(res.success).toBe(true);
    expect(res.results).toEqual([{ id: '1', category: 'Food & Drink' }]);
    expect(res.warning).toBeUndefined();
  });

  it('handles 429 rate limit with friendly error message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () =>
        JSON.stringify({
          error: 'Terlalu banyak permintaan (Rate limit). Silakan coba beberapa saat lagi.',
        }),
    });

    await expect(
      categorizeExpenses([{ id: '1', name: 'Nasi padang' }])
    ).rejects.toThrow('Terlalu banyak permintaan (Rate limit)');
  });

  it('does not throw SyntaxError when backend returns empty or non-JSON body on error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => '', // empty response, typically triggers Unexpected end of JSON input
    });

    await expect(
      categorizeExpenses([{ id: '1', name: 'Nasi padang' }])
    ).rejects.toThrow(ApiError);
  });

  it('handles fallback responses with warning message properly', async () => {
    const mockFallback = {
      success: true,
      isFallback: true,
      warning:
        'Layanan AI sedang sibuk (Rate limit). Kategori disetel default ke Uncategorized.',
      results: [{ id: '1', category: 'Uncategorized' }],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockFallback),
    });

    const res = await categorizeExpenses([{ id: '1', name: 'Nasi padang' }]);
    expect(res.success).toBe(true);
    expect(res.isFallback).toBe(true);
    expect(res.warning).toContain('Rate limit');
    expect(res.results[0].category).toBe('Uncategorized');
  });

  it('handles network failure gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    await expect(
      categorizeExpenses([{ id: '1', name: 'Nasi padang' }])
    ).rejects.toThrow('Gagal terhubung ke server');
  });
});
