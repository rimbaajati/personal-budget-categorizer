interface UnparsedListProps {
  unparsed: string[];
}

export function UnparsedList({ unparsed }: UnparsedListProps) {
  if (unparsed.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
        <h3 className="text-sm font-semibold">Could not read these lines</h3>
      </div>
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
        These lines were missing a recognizable name or amount and were skipped:
      </p>
      <ul className="mt-2 space-y-1">
        {unparsed.map((line, index) => (
          <li
            key={index}
            className="rounded bg-amber-100/60 px-2 py-1 font-mono text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
          >
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
