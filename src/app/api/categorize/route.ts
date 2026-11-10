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
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  let rawBodyText = '';
  try {
    rawBodyText = await request.text();
  } catch {
    return NextResponse.json(
      { error: 'Failed to read request body.' },
      { status: 400 }
    );
  }

  if (rawBodyText.length > 2000) {
    return NextResponse.json(
      { error: 'Input exceeds maximum allowed limit of 2,000 characters.' },
      { status: 400 }
    );
  }

  let body: { items?: unknown };
  try {
    body = JSON.parse(rawBodyText);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json(
      { error: 'Payload must include an items array.' },
      { status: 400 }
    );
  }

  const items = body.items as InputItem[];

  if (items.length === 0) {
    return NextResponse.json(
      { error: 'Items array cannot be empty.' },
      { status: 400 }
    );
  }

  if (items.length > 50) {
    return NextResponse.json(
      { error: 'Cannot categorize more than 50 items at once.' },
      { status: 400 }
    );
  }

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
          error:
            'Each item must have a valid id and a non-empty name string.',
        },
        { status: 400 }
      );
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured on the server.' },
      { status: 500 }
    );
  }

  if (!model) {
    return NextResponse.json(
      { error: 'GEMINI_MODEL is not configured on the server.' },
      { status: 500 }
    );
  }

  const idMap = new Map<number, string | number>();
  const geminiItems = items.map((item, index) => {
    const tempId = index + 1;
    idMap.set(tempId, item.id);
    return {
      id: tempId,
      name: item.name.trim(),
    };
  });

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const response = await fetch(geminiUrl, {
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
    });

    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502;
      return NextResponse.json(
        { error: 'Failed to communicate with AI categorization service.' },
        { status }
      );
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

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

    const results = items.map((item) => {
      const category = resultMap.get(item.id) ?? 'Uncategorized';
      return {
        id: item.id,
        category,
      };
    });

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred during categorization.' },
      { status: 500 }
    );
  }
}
