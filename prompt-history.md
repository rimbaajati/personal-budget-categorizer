# Prompt History: Personal Budget Categorizer (Task 2)

Agentic coding log for the MVP build. Every prompt below was sent, in this order and unchanged, to the coding agent inside the IDE.

| Item              | Detail                                                    |
| ----------------- | --------------------------------------------------------- |
| Tool              | Google Antigravity IDE (agentic coding)                   |
| Stack             | Next.js (App Router), TypeScript, Tailwind CSS, Vitest    |
| AI API in the app | Google Gemini API (called server-side only)               |
| Prompt language   | English                                                   |
| Repository        | https://github.com/rimbaajati/personal-budget-categorizer |

Note: the prompts were drafted with AI assistance (Claude) from the product decisions made in Task 1, then executed by the IDE agent. No application code was copied and pasted by hand; all code was generated and tested by the agent.

---

## Prompt 1: Project scaffold

```text
Create a Next.js (App Router, TypeScript, Tailwind) project called
"personal-budget-categorizer" in the current folder.

Product: a single-page, mobile-first web app. The user pastes messy
Indonesian expense notes (e.g. "grab 25k, nasi padang 18k, pulsa 50k").
Code parses the amounts with regex. Only the item NAMES are sent to an
AI API (Google Gemini), which assigns each item one category from a
fixed list. The UI shows an editable item table and totals per
category. Nothing is stored.

Set up: clean folder structure (src/lib, src/app/api/categorize,
src/components), .env.example with GEMINI_API_KEY and GEMINI_MODEL,
.env.local in .gitignore, and a README stub. Do not build features yet.
Run the dev server and confirm it starts.
```

**Result:** Project created with the requested folder structure, `.env.example`, and `.gitignore` covering `.env.local`. Dev server starts and shows the default Next.js page.

---

## Prompt 2: Amount parser (code, not AI)

```text
Build src/lib/parser.ts: parseNotes(text) -> { items: {id, name,
amount}[], unparsed: string[] }.

Rules:
- Split on commas, newlines, and semicolons.
- Amount formats: 25k, 25rb, 25.000, 25,000, 1,5jt, 1.5jt, 2jt.
- Item name is the text without the amount. Strip a leading quantity
  like "2x".
- Lines with no valid amount or no name go into `unparsed`, never
  dropped silently.
- Ambiguity rule: in "25.000" and "25,000" the separator is a thousands
  separator, but in "1,5jt" and "1.5jt" it is a decimal. Decide by the
  suffix (jt/k/rb) and the digits after the separator.
Write unit tests (Vitest) covering every format above plus edge cases
(empty input, only numbers, mixed case like "25K", extra spaces), and
run them until they pass.
```

**Result:** `parser.ts` and `parser.test.ts` created. Amounts are parsed locally with regex; unreadable lines are returned in `unparsed`. Tests pass.

---

## Prompt 3: Gemini API route

```text
Build the API route src/app/api/categorize/route.ts (POST).

- Input: { items: [{id, name}] } (names only, never amounts).
- Call the Gemini API server-side using GEMINI_API_KEY and the model
  from GEMINI_MODEL (read both from process.env, never hardcode them).
  Use temperature 0 and JSON output mode. Check the current Gemini API
  docs for the correct SDK or REST usage before writing the call.
- Put the system prompt in src/lib/systemPrompt.ts, exactly this text:

You are an expense categorizer for Indonesian personal budgeting notes.

TASK
You receive a JSON object containing a list of expense item names. Assign
exactly one category to each item. Item names may be in Indonesian, English,
or informal slang (e.g. "nasi padang", "es teh", "bensin", "kos").

ALLOWED CATEGORIES (use these exact strings, nothing else)
1. Food & Drink
2. Transport
3. Bills & Utilities
4. Shopping
5. Health
6. Entertainment
7. Education
8. Gifts & Donations
9. Uncategorized

INPUT FORMAT
{"items":[{"id":1,"name":"grab"},{"id":2,"name":"nasi padang"}]}

OUTPUT FORMAT
Respond with a single valid JSON object and nothing else: no markdown
fences, no explanations, no extra keys.
{"results":[{"id":<integer from input>,"category":"<one allowed category>"}]}

RULES
- Return exactly one result per input item, using the same id. Never add,
  merge, split, or skip items.
- Never output anything except the JSON object.
- Never guess. If an item is unclear, too vague, or does not fit any
  category, use "Uncategorized".

AMBIGUOUS ITEMS
- "grab", "gojek", "gocar", "grabbike", "ojol", "taksi online" -> Transport.
- "grabfood", "grab food", "gofood", "shopeefood" -> Food & Drink.
- "pulsa", "paket data", "token listrik", "wifi", "indihome", "listrik",
  "air" (as a utility bill) -> Bills & Utilities.
- "topup", "isi saldo", "top up gopay/ovo/dana" -> Uncategorized, because
  the final use of the money is unknown.
- Store names alone ("indomaret", "alfamart") -> Shopping, unless the item
  name itself names a food or drink, in which case use Food & Drink.
- "kos", "sewa", "kontrakan" -> Bills & Utilities.
- "infaq", "sedekah", "kado", "angpao" -> Gifts & Donations.
- Any item that is a bare number, a symbol, or unreadable text ->
  Uncategorized.

- Validate the AI response in code: every input id must be present,
  every category must be in the allowed list, otherwise fall back to
  "Uncategorized". Match results to items by id, not by position.
- Limit input to 50 items and 2,000 characters total, add simple
  in-memory rate limiting per IP, and return clear JSON error messages
  with proper status codes.
- Never log or return the API key.
Test the route with a request using sample items and show me the
output. Give me a test command that works on Windows PowerShell.
```

**Result:** `route.ts` and `systemPrompt.ts` created. Tested with a PowerShell request: grab -> Transport, nasi padang -> Food & Drink, pulsa -> Bills & Utilities, infaq -> Gifts & Donations, vague items -> Uncategorized. An empty request returns HTTP 400 as expected.

---

## Prompt 4: Single-page UI

```text
Build the single-page UI, clean and mobile-first, using the existing
parser (src/lib/parser.ts) and the existing API route
(/api/categorize). Keep the id type consistent between them.

- A textarea for pasted notes, an "Fill example" button
  ("grab 25k, nasi padang 18k, pulsa 50k, kopi 1,5rb, infaq masjid 20rb")
  and an "Analyze" button with a loading state.
- Flow: parse amounts with the parser (code), send ONLY item names to
  /api/categorize, then merge categories with local amounts by id.
- Result table: item, amount (Indonesian Rupiah format), and a category
  dropdown the user can change. Totals update instantly on every edit.
- Totals per category as horizontal bars plus a grand total.
- A visible "Could not read these lines" box for unparsed lines.
- A short privacy note: only item names are sent to the AI, amounts
  stay on the device, nothing is stored.
- Handle empty, error (including rate limit) and loading states.
- Clean, minimal design with Tailwind. Do not add extra features.
Run the app and verify the full flow with the example text above.
```

**Result:** UI built and verified in the browser: notes are parsed locally, only item names are sent to the API, categories are merged back by id, the category dropdown updates totals instantly, and the bars and grand total render correctly.

---

## Prompt 5: Finish, lint, build, push

```text
Finish the project:
1. Write a clear README.md: what the app is, how it works (regex parser
   for amounts, only item names sent to the Gemini API, nothing stored),
   features, tech stack, local setup, environment variables
   (GEMINI_API_KEY, GEMINI_MODEL) and how to deploy on Vercel.
2. Run lint and build (npm run lint, npm run build) and fix all errors
   and warnings.
3. Make sure .env.local is ignored and .env.example contains only
   placeholders. Do not touch prompt-history.md.
4. Commit with a clear message and push to origin main.
5. Tell me which environment variables to set on Vercel.
```

**Result:** README written, lint and build run, `.env.example` contains placeholders only, changes pushed to `origin/main`. The agent listed the Vercel environment variables to set: `GEMINI_API_KEY` and `GEMINI_MODEL`.

## Prompt 6 : Fix Error Deploy

The Vercel build fails on "npm install" with ERESOLVE: vitest@5.1.0
needs @types/node "^22.0.0 || >=24.0.0", but the project has
@types/node "^20". Fix the dependency conflict properly without using
--force or --legacy-peer-deps:

1. Upgrade @types/node to a version compatible with both vitest 5.1.0
   and vite 8.3.7 (for example ^22.12.0).
2. Run a clean install (delete node_modules and package-lock.json, then
   npm install) and make sure it completes with no ERESOLVE errors.
3. Run npm run lint, npm run test (vitest) and npm run build, and fix
   anything that breaks.
4. Commit with a clear message and push to origin main.
