import { useMemo } from 'react';
import { formatRupiah } from '@/lib/formatters';
import { ALLOWED_CATEGORIES, AllowedCategory } from '@/lib/systemPrompt';

interface CategorizedItem {
  id: string;
  name: string;
  amount: number;
  category: AllowedCategory;
}

interface CategoryBreakdownProps {
  items: CategorizedItem[];
}

const CATEGORY_COLORS: Record<AllowedCategory, string> = {
  'Food & Drink': 'bg-amber-500',
  Transport: 'bg-sky-500',
  'Bills & Utilities': 'bg-rose-500',
  Shopping: 'bg-violet-500',
  Health: 'bg-emerald-500',
  Entertainment: 'bg-pink-500',
  Education: 'bg-indigo-500',
  'Gifts & Donations': 'bg-teal-500',
  Uncategorized: 'bg-zinc-400 dark:bg-zinc-500',
};

export function CategoryBreakdown({ items }: CategoryBreakdownProps) {
  const { grandTotal, breakdown } = useMemo(() => {
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const categoryTotals = new Map<AllowedCategory, number>();

    for (const cat of ALLOWED_CATEGORIES) {
      categoryTotals.set(cat, 0);
    }

    for (const item of items) {
      const current = categoryTotals.get(item.category) ?? 0;
      categoryTotals.set(item.category, current + item.amount);
    }

    const activeBreakdown = Array.from(categoryTotals.entries())
      .filter(([, amount]) => amount > 0)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { grandTotal: total, breakdown: activeBreakdown };
  }, [items]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-baseline justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <div>
          <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Grand Total
          </span>
          <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatRupiah(grandTotal)}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {breakdown.map(({ category, amount, percentage }) => (
          <div key={category} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
                <span
                  className={`h-2 w-2 rounded-full ${CATEGORY_COLORS[category]}`}
                />
                {category}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-zinc-500 dark:text-zinc-400">
                  {percentage.toFixed(0)}%
                </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatRupiah(amount)}
                </span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${CATEGORY_COLORS[category]}`}
                style={{ width: `${Math.max(percentage, 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
