'use client';

import { useState } from 'react';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { CategorizedItem, ItemTable } from '@/components/ItemTable';
import { UnparsedList } from '@/components/UnparsedList';
import { parseNotes } from '@/lib/parser';
import { AllowedCategory } from '@/lib/systemPrompt';
import { ApiError, categorizeExpenses } from '@/lib/requests';

const EXAMPLE_NOTE =
  'grab 25k, nasi padang 18k, pulsa 50k, kopi 1,5rb, infaq masjid 20rb';

const MAX_INPUT_LENGTH = 2000;
const MAX_ITEMS = 30;

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [items, setItems] = useState<CategorizedItem[]>([]);
  const [unparsed, setUnparsed] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const handleFillExample = () => {
    setInputText(EXAMPLE_NOTE);
    setErrorMessage(null);
    setWarningMessage(null);
  };

  const handleCategoryChange = (id: string, newCategory: AllowedCategory) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, category: newCategory } : item
      )
    );
  };

  const handleAnalyze = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      setErrorMessage('Silakan masukkan catatan pengeluaran untuk dianalisis.');
      setWarningMessage(null);
      return;
    }

    // 1. Validasi batas maksimum 2.000 karakter pada UI
    if (trimmed.length > MAX_INPUT_LENGTH) {
      setErrorMessage(
        `Input melebihi batas maksimum ${MAX_INPUT_LENGTH.toLocaleString('id-ID')} karakter (saat ini ${trimmed.length} karakter). Mohon perpendek catatan Anda.`
      );
      setWarningMessage(null);
      return;
    }

    setErrorMessage(null);
    setWarningMessage(null);
    setIsLoading(true);

    try {
      const parsedResult = parseNotes(trimmed);
      setUnparsed(parsedResult.unparsed);

      if (parsedResult.items.length === 0) {
        setItems([]);
        if (parsedResult.unparsed.length > 0) {
          setErrorMessage(
            'Tidak ditemukan item pengeluaran dengan nominal yang valid.'
          );
        } else {
          setErrorMessage('Tidak ada catatan pengeluaran yang ditemukan.');
        }
        setIsLoading(false);
        return;
      }

      // 2. Truncate / slice maksimal 30 item sebelum dikirim ke AI
      let itemsToProcess = parsedResult.items;
      let truncationNotice: string | null = null;
      if (itemsToProcess.length > MAX_ITEMS) {
        itemsToProcess = itemsToProcess.slice(0, MAX_ITEMS);
        truncationNotice = `Maksimal ${MAX_ITEMS} item per analisis. Hanya ${MAX_ITEMS} item pertama yang diproses.`;
      }

      const payloadItems = itemsToProcess.map((item) => ({
        id: item.id,
        name: item.name,
      }));

      // 3. Panggilan ke backend menggunakan modul fetch requests yang robust
      const data = await categorizeExpenses(payloadItems);

      const categoryMap = new Map<string, AllowedCategory>();
      if (Array.isArray(data?.results)) {
        for (const r of data.results) {
          categoryMap.set(String(r.id), r.category as AllowedCategory);
        }
      }

      const mergedItems: CategorizedItem[] = itemsToProcess.map((item) => ({
        ...item,
        category: categoryMap.get(item.id) || 'Uncategorized',
      }));

      setItems(mergedItems);

      // Kumpulkan pesan peringatan (truncation notice atau fallback warning dari backend)
      const warnings: string[] = [];
      if (truncationNotice) {
        warnings.push(truncationNotice);
      }
      if (data.warning) {
        warnings.push(data.warning);
      }

      if (warnings.length > 0) {
        setWarningMessage(warnings.join(' '));
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          'Terjadi kesalahan yang tidak terduga saat memproses permintaan.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isOverLengthLimit = inputText.length > MAX_INPUT_LENGTH;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900 sm:py-12 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Personal Budget Categorizer
          </h1>
          <p className="text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
            Paste messy Indonesian expense notes. Amounts are parsed locally;
            names are categorized with AI.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <label
              htmlFor="expense-input"
              className="block text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-400"
            >
              Expense Notes
            </label>
            <span
              className={`text-[11px] font-mono transition-colors ${
                isOverLengthLimit
                  ? 'font-bold text-red-600 dark:text-red-400'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              {inputText.length.toLocaleString('id-ID')} /{' '}
              {MAX_INPUT_LENGTH.toLocaleString('id-ID')}
            </span>
          </div>

          <textarea
            id="expense-input"
            rows={4}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (errorMessage && e.target.value.length <= MAX_INPUT_LENGTH) {
                setErrorMessage(null);
              }
            }}
            placeholder="e.g. grab 25k, nasi padang 18k, pulsa 50k"
            className={`mt-2 w-full rounded-xl border p-3 text-sm text-zinc-900 transition-colors focus:outline-none focus:ring-1 dark:text-zinc-100 ${
              isOverLengthLimit
                ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-500 dark:border-red-800 dark:bg-red-950/20'
                : 'border-zinc-200 bg-zinc-50/50 focus:border-zinc-900 focus:bg-white focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/50 dark:focus:border-zinc-100 dark:focus:bg-zinc-800 dark:focus:ring-zinc-100'
            }`}
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleFillExample}
              disabled={isLoading}
              className="text-xs font-medium text-zinc-600 underline underline-offset-4 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Fill example
            </button>

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isLoading ? (
                <>
                  <svg
                    className="h-3.5 w-3.5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Analyzing...</span>
                </>
              ) : (
                <span>Analyze</span>
              )}
            </button>
          </div>

          <div className="mt-4 flex items-center gap-1.5 border-t border-zinc-100 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <svg
              className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            <span>
              Privacy note: Only item names are sent to the AI. Amounts stay on
              your device, and nothing is stored.
            </span>
          </div>
        </section>

        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {warningMessage && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <span>{warningMessage}</span>
          </div>
        )}

        <UnparsedList unparsed={unparsed} />

        {items.length > 0 && (
          <div className="space-y-6">
            <CategoryBreakdown items={items} />
            <ItemTable
              items={items}
              onCategoryChange={handleCategoryChange}
            />
          </div>
        )}
      </div>
    </main>
  );
}
