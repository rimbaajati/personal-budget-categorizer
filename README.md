# Personal Budget Categorizer

A single-page, mobile-first web application that categorizes messy Indonesian expense notes using local regex parsing and Google Gemini AI.

## What It Is

Personal Budget Categorizer helps users quickly organize informal expense notes commonly written in Indonesian shorthand (e.g., `grab 25k, nasi padang 18k, pulsa 50k, kopi 1,5rb, infaq masjid 20rb`).

## How It Works

1. **Client-Side Amount Parsing**: A regex parser runs in the browser to detect amounts across common Indonesian formats (`25k`, `25rb`, `25.000`, `25,000`, `1,5jt`, `1.5jt`, `2jt`), stripping leading quantities like `2x`. Separator ambiguity is resolved based on the suffix and post-separator digits.
2. **Privacy-Preserving AI Categorization**: Only the extracted item names are sent to the backend `/api/categorize` endpoint and forwarded to Google Gemini. Numerical amounts never leave your device.
3. **Stateless Architecture**: Nothing is stored in any database or session. The entire application runs client-side with an ephemeral API route.
4. **Real-Time Client Merging**: The client merges AI-assigned categories with local amounts, providing an interactive item table and category total summaries that recalculate instantly on edit.

## Features

- **Indonesian Expense Parsing**: Supports delimiters (`,`, `;`, `\n`), units (`k`, `rb`, `jt`), and decimal/thousands formatting.
- **Fixed Category Mapping**: Every item is assigned to one of 9 fixed categories:
  - Food & Drink
  - Transport
  - Bills & Utilities
  - Shopping
  - Health
  - Entertainment
  - Education
  - Gifts & Donations
  - Uncategorized
- **Interactive UI**: Change item categories with instant total recalculation.
- **Visual Breakdown**: Horizontal proportional bars showing share of spending per category alongside grand total in Indonesian Rupiah (`IDR`).
- **Unparsed Notice**: Dedicated "Could not read these lines" section displaying any skipped or malformed inputs.
- **API Guardrails**: Server-side in-memory rate limiting, payload size limits (50 items, 2,000 characters), and strict schema validation.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI Model**: Google Gemini API (`@google/genai` REST integration)
- **Unit Testing**: Vitest

## Local Setup

### Prerequisites

- Node.js 18+ (tested on Node 20 / 24)
- npm, pnpm, or yarn

### 1. Clone the repository

```bash
git clone https://github.com/rimbaajati/personal-budget-categorizer.git
cd personal-budget-categorizer
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Add your Google Gemini API key to `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run tests

```bash
npm test
```

## Environment Variables

| Variable | Required | Description | Default / Example |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key obtained from Google AI Studio | `your_api_key_here` |
| `GEMINI_MODEL` | Yes | Gemini model identifier | `gemini-3.5-flash` |

## Deploying on Vercel

1. Push your repository to GitHub.
2. Sign in to [Vercel](https://vercel.com) and click **Add New Project**.
3. Import your `personal-budget-categorizer` repository.
4. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: Your Gemini API key.
   - `GEMINI_MODEL`: `gemini-3.5-flash`.
5. Click **Deploy**. Vercel will automatically build and deploy the Next.js application.
