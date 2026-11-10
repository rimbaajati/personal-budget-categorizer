import { NextRequest, NextResponse } from 'next/server';
import {
  ALLOWED_CATEGORIES,
  AllowedCategory,
  SYSTEM_PROMPT,
} from '@/lib/systemPrompt';

interface InputItem {
  id: string | number;
  name: string;
}

const MAX_INPUT_LENGTH = 2000;
const MAX_ITEMS = 30;
const AI_TIMEOUT_MS = 8500; // 8.5 seconds to stay safely within Vercel's 10s limit

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 20;

  if (rateLimitMap.size > 500) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Cek API Key di awal fungsi
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'GEMINI_API_KEY belum dikonfigurasi di server.',
        },
        { status: 500 }
      );
    }

    // 2. Rate Limiting IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Terlalu banyak permintaan (Rate limit). Silakan coba beberapa saat lagi.',
        },
        { status: 429 }
      );
    }

    // 3. Baca dan validasi panjang raw body (maks 2.000 karakter)
    let rawBodyText = '';
    try {
      rawBodyText = await request.text();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Gagal membaca body permintaan.' },
        { status: 400 }
      );
    }

    if (rawBodyText.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `Input melebihi batas maksimum ${MAX_INPUT_LENGTH.toLocaleString('id-ID')} karakter.`,
        },
        { status: 400 }
      );
    }

    // 4. Parse JSON
    let body: { items?: unknown };
    try {
      body = JSON.parse(rawBodyText);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Format JSON permintaan tidak valid.' },
        { status: 400 }
      );
    }

    if (!body || !Array.isArray(body.items)) {
      return NextResponse.json(
        { success: false, error: 'Payload harus menyertakan array items.' },
        { status: 400 }
      );
    }

    if (body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Array items tidak boleh kosong.' },
        { status: 400 }
      );
    }

    // 5. Truncate / slicing maksimal 30 item
    const rawItems = body.items as InputItem[];
    const items = rawItems.slice(0, MAX_ITEMS);

    for (const item of items) {
      if (
        !item ||
        item.id === undefined ||
        item.id === null ||
        typeof item.name !== 'string' ||
        item.name.trim().length === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Setiap item harus memiliki id yang valid dan nama non-kosong.',
          },
          { status: 400 }
        );
      }
    }

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    // Map temp IDs to prevent prompt injection or parsing anomalies
    const idMap = new Map<number, string | number>();
    const geminiItems = items.map((item, index) => {
      const tempId = index + 1;
      idMap.set(tempId, item.id);
      return {
        id: tempId,
        name: item.name.trim(),
      };
    });

    // Helper untuk Fallback Strategy
    const createFallbackResponse = (warning: string) => {
      const fallbackResults = items.map((item) => ({
        id: item.id,
        category: 'Uncategorized' as AllowedCategory,
      }));
      return NextResponse.json({
        success: true,
        isFallback: true,
        warning,
        results: fallbackResults,
      });
    };

    // 6. Pemanggilan AI dengan AbortController timeout (8.5 detik)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: JSON.stringify({ items: geminiItems }) }],
            },
          ],
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      const isAbort =
        (fetchErr instanceof Error && fetchErr.name === 'AbortError') ||
        controller.signal.aborted;

      // Resiliency: Jika AI timeout atau error jaringan, kembalikan fallback kategori default
      return createFallbackResponse(
        isAbort
          ? 'Waktu proses AI habis (timeout). Kategori disetel default ke Uncategorized.'
          : 'Layanan AI sementara tidak terhubung. Kategori disetel default ke Uncategorized.'
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // 7. Penanganan jika AI mengembalikan status 429 atau error lainnya
    if (!geminiResponse.ok) {
      if (geminiResponse.status === 429) {
        return createFallbackResponse(
          'Layanan AI sedang sibuk (Rate limit tercapai). Kategori disetel default ke Uncategorized.'
        );
      }
      return createFallbackResponse(
        'Layanan AI mengalami kendala sementara. Kategori disetel default ke Uncategorized.'
      );
    }

    // 8. Parse output AI
    let data: Record<string, unknown> | null = null;
    try {
      data = await geminiResponse.json();
    } catch {
      return createFallbackResponse(
        'Format respons AI tidak dapat dibaca. Kategori disetel default ke Uncategorized.'
      );
    }

    const rawText = (
      data as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      }
    )?.candidates?.[0]?.content?.parts?.[0]?.text;

    let parsedResults: Array<{ id: unknown; category: unknown }> = [];
    if (typeof rawText === 'string') {
      try {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed?.results)) {
          parsedResults = parsed.results;
        }
      } catch {
        parsedResults = [];
      }
    }

    const resultMap = new Map<string | number, AllowedCategory>();
    for (const res of parsedResults) {
      const mappedOriginalId =
        typeof res.id === 'number' && idMap.has(res.id)
          ? idMap.get(res.id)!
          : (res.id as string | number);

      if (
        typeof res.category === 'string' &&
        ALLOWED_CATEGORIES.includes(res.category as AllowedCategory)
      ) {
        resultMap.set(mappedOriginalId, res.category as AllowedCategory);
      }
    }

    const results = items.map((item) => ({
      id: item.id,
      category: resultMap.get(item.id) ?? ('Uncategorized' as AllowedCategory),
    }));

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Unhandled error in /api/categorize:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          'Terjadi kesalahan internal pada server. Silakan coba beberapa saat lagi.',
      },
      { status: 500 }
    );
  }
}
