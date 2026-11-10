# Personal Budget Categorizer

A single-page, mobile-first web application that categorizes messy Indonesian expense notes using regex and Google Gemini AI.

## Overview

- **Input Parsing**: Parses Indonesian expense notes (e.g. `grab 25k, nasi padang 18k, pulsa 50k`) using regex for amounts.
- **AI Categorization**: Only item names are sent to Google Gemini API to map each item to a fixed list of categories.
- **Interactive UI**: Displays an editable item table and category total summaries.
- **Privacy First**: Zero persistent storage; runs client/stateless API only.

## Getting Started

1. Copy `.env.example` to `.env.local` and add your Gemini API key:
   ```bash
   cp .env.example .env.local
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.
