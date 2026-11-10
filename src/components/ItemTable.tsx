import { formatRupiah } from '@/lib/formatters';
import { ALLOWED_CATEGORIES, AllowedCategory } from '@/lib/systemPrompt';

export interface CategorizedItem {
  id: string;
  name: string;
  amount: number;
  category: AllowedCategory;
}

interface ItemTableProps {
  items: CategorizedItem[];
  onCategoryChange: (id: string, newCategory: AllowedCategory) => void;
}

export function ItemTable({ items, onCategoryChange }: ItemTableProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Parsed Items
        </h3>
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 p-4 transition-colors hover:bg-zinc-50/50 sm:flex-row sm:items-center sm:justify-between sm:gap-4 dark:hover:bg-zinc-800/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900 capitalize dark:text-zinc-100">
                {item.name}
              </p>
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                {formatRupiah(item.amount)}
              </p>
            </div>

            <div className="w-full sm:w-48">
              <select
                value={item.category}
                onChange={(e) =>
                  onCategoryChange(item.id, e.target.value as AllowedCategory)
                }
                aria-label={`Category for ${item.name}`}
                className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 shadow-sm transition-colors focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
              >
                {ALLOWED_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
