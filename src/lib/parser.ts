export interface ParsedItem {
  id: string;
  name: string;
  amount: number;
}

export interface ParseResult {
  items: ParsedItem[];
  unparsed: string[];
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface MatchCandidate {
  raw: string;
  index: number;
  amount: number;
}

function calculateAmount(rawNumber: string, unit?: string): number {
  if (unit) {
    const normalizedUnit = unit.toLowerCase();
    if (normalizedUnit === 'jt' || normalizedUnit === 'juta') {
      const val = parseFloat(rawNumber.replace(',', '.'));
      return Math.round(val * 1_000_000);
    }
    if (
      normalizedUnit === 'k' ||
      normalizedUnit === 'rb' ||
      normalizedUnit === 'ribu'
    ) {
      if (rawNumber.includes('.') || rawNumber.includes(',')) {
        const parts = rawNumber.split(/[.,]/);
        if (parts[1].length === 3) {
          return parseInt(parts[0] + parts[1], 10) * 1000;
        }
        return Math.round(parseFloat(`${parts[0]}.${parts[1]}`) * 1000);
      }
      return parseInt(rawNumber, 10) * 1000;
    }
  }

  const parts = rawNumber.split(/[.,]/);
  if (parts.length > 1) {
    const isThousands = parts.slice(1).every((p) => p.length === 3);
    if (isThousands) {
      return parseInt(rawNumber.replace(/[.,]/g, ''), 10);
    }
    return Math.round(parseFloat(rawNumber.replace(',', '.')));
  }

  return parseInt(rawNumber, 10);
}

function findSuffixedAmount(chunk: string): MatchCandidate | null {
  const regex =
    /(?:(?:rp\.?|idr)\s*)?(\d+(?:[.,]\d+)?)\s*(jt|juta|k|rb|ribu)\b/gi;
  let match: RegExpExecArray | null = null;
  let chosenMatch: MatchCandidate | null = null;

  while ((match = regex.exec(chunk)) !== null) {
    const rawNumber = match[1];
    const unit = match[2];
    chosenMatch = {
      raw: match[0],
      index: match.index,
      amount: calculateAmount(rawNumber, unit),
    };
  }

  return chosenMatch;
}

function findThousandsAmount(chunk: string): MatchCandidate | null {
  const regex =
    /(?:(?:rp\.?|idr)\s*)?(\d{1,3}(?:[.,]\d{3})+)\b(?!\s*(?:jt|juta|k|rb|ribu)\b)/gi;
  let match: RegExpExecArray | null = null;
  let chosenMatch: MatchCandidate | null = null;

  while ((match = regex.exec(chunk)) !== null) {
    const rawNumber = match[1];
    chosenMatch = {
      raw: match[0],
      index: match.index,
      amount: calculateAmount(rawNumber),
    };
  }

  return chosenMatch;
}

function findPlainAmount(chunk: string): MatchCandidate | null {
  const rpRegex = /(?:rp\.?|idr)\s*(\d+)\b/gi;
  let match: RegExpExecArray | null = null;
  let chosenMatch: MatchCandidate | null = null;

  while ((match = rpRegex.exec(chunk)) !== null) {
    chosenMatch = {
      raw: match[0],
      index: match.index,
      amount: parseInt(match[1], 10),
    };
  }
  if (chosenMatch) {
    return chosenMatch;
  }

  const endRegex = /(?:\s|^)(\d{3,9})\s*$/;
  const endMatch = chunk.match(endRegex);
  if (endMatch && endMatch.index !== undefined) {
    const matchedStr = endMatch[1];
    const startIndex = chunk.lastIndexOf(matchedStr);
    return {
      raw: matchedStr,
      index: startIndex,
      amount: parseInt(matchedStr, 10),
    };
  }

  const startRegex = /^\s*(\d{3,9})\s+(?!x\b)/i;
  const startMatch = chunk.match(startRegex);
  if (startMatch && startMatch.index !== undefined) {
    const matchedStr = startMatch[1];
    return {
      raw: matchedStr,
      index: chunk.indexOf(matchedStr),
      amount: parseInt(matchedStr, 10),
    };
  }

  const onlyNumberRegex = /^\s*(\d+)\s*$/;
  const onlyMatch = chunk.match(onlyNumberRegex);
  if (onlyMatch && onlyMatch.index !== undefined) {
    return {
      raw: onlyMatch[1],
      index: chunk.indexOf(onlyMatch[1]),
      amount: parseInt(onlyMatch[1], 10),
    };
  }

  return null;
}

function cleanItemName(text: string): string {
  return text
    .replace(/^\s*\d+\s*[xX](?!\d)\s*/, '')
    .replace(/^[\s\-:=@]+|[\s\-:=@]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitNotes(text: string): string[] {
  const numberCommaRegex =
    /(?<=\d),(?=\d{3}(?!\d))|(?<=\d),(?=\d+\s*(?:jt|juta|k|rb|ribu)\b)/gi;
  const placeholder = '__NUM_COMMA__';
  const protectedText = text.replace(numberCommaRegex, placeholder);
  const rawChunks = protectedText.split(/[,;\r\n]+/);
  return rawChunks.map((chunk) => chunk.replaceAll(placeholder, ','));
}

export function parseNotes(text: string): ParseResult {
  const items: ParsedItem[] = [];
  const unparsed: string[] = [];

  if (typeof text !== 'string') {
    return { items, unparsed };
  }

  const chunks = splitNotes(text);

  for (const rawChunk of chunks) {
    const chunk = rawChunk.trim();
    if (!chunk) {
      continue;
    }

    const candidate =
      findSuffixedAmount(chunk) ||
      findThousandsAmount(chunk) ||
      findPlainAmount(chunk);

    if (!candidate) {
      unparsed.push(chunk);
      continue;
    }

    const before = chunk.slice(0, candidate.index);
    const after = chunk.slice(candidate.index + candidate.raw.length);
    const rawName = `${before} ${after}`.trim();
    const name = cleanItemName(rawName);

    if (!name || isNaN(candidate.amount) || candidate.amount <= 0) {
      unparsed.push(chunk);
      continue;
    }

    items.push({
      id: generateId(),
      name,
      amount: candidate.amount,
    });
  }

  return { items, unparsed };
}
