<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Code Guardian AI

AI-powered, in-browser code reviewer that fetches files from a public GitHub repository and uses Google's Gemini model to produce concise, actionable code-review suggestions.

This repo is a small React + Vite single-page app. Enter a Gemini API key, paste a public GitHub repo URL, fetch the file tree, then analyze individual files or the whole repository.

## Quick overview

- UI: React + Vite (see `App.tsx`, `index.tsx`).
- GitHub access: client-side GitHub API wrapper at `services/githubService.ts`.
- AI integration: `services/geminiService.ts` uses `@google/genai` to request structured JSON reviews.
- Types and data shapes: `types.ts` defines file/tree/review types.

## How it works (short)

- User provides a Gemini API key in the UI (stored in localStorage).
- User pastes a GitHub repository URL and clicks "Fetch Repository Files".
- The app calls GitHub REST API to get the repository file tree, prioritizes source files, and renders a file browser.
- Selecting a file downloads its content and calls Gemini (via `@google/genai`) to request a structured JSON code review.
- The app displays the file content and the AI's summary + suggestions. You can also run "Analyze Entire Repo" to scan multiple source files.

## Features

- Fetch a public GitHub repository tree and browse files.
- Analyze a single file with Gemini and receive:
  - high-level summary
  - categorized, line-aware suggestions with example fixes
- Bulk-analyze repositories (restricted to common source file extensions).

## Requirements

- Node.js (recommended v18+)
- A Gemini API key for the AI reviews

## Deployment to Vercel

1. Connect your GitHub repository to Vercel
2. In the Vercel dashboard, add the following environment variables:
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `GITHUB_TOKEN`: Your GitHub Personal Access Token
3. Deploy the application

The environment variables will be automatically available to your application through Vite's build process.

## Important security notes

- GitHub tokens are now properly handled through environment variables instead of being hardcoded.
- For local development: Use `.env.local` (which is gitignored) to store your tokens safely.
- For Vercel deployment: Set environment variables in the Vercel dashboard.
- The GitHub token is still exposed on the client-side due to the browser-only architecture. For production applications, consider:
  - Moving GitHub API requests to a backend service that safely stores the token and proxies requests.
  - Rate limiting and caching requests on the server to avoid hitting GitHub limits.

## Install and run (local)

1. Install dependencies

   ```powershell
   npm install
   ```

2. Set up environment variables

   Copy `.env.local.example` to `.env.local` and add your API keys:
   
   ```powershell
   cp .env.local.example .env.local
   ```
   
   Then edit `.env.local` with your actual tokens:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   GITHUB_TOKEN=your_github_token_here
   ```

3. Start the dev server

   ```powershell
   npm run dev
   ```

4. Open the app in your browser at the address Vite prints (usually http://localhost:5173).

## Basic usage

1. Enter your Gemini API key in the sidebar input (it is saved to `localStorage`).
2. Paste a public GitHub repository URL (for example `https://github.com/owner/repo`) and click "Fetch Repository Files".
3. Click individual files to analyze them, or click "Analyze Entire Repo" to run the AI across multiple source files.

## Important security notes

- GitHub tokens are now properly handled through environment variables instead of being hardcoded.
- For local development: Use `.env.local` (which is gitignored) to store your tokens safely.
- For Vercel deployment: Set environment variables in the Vercel dashboard.
- The GitHub token is still exposed on the client-side due to the browser-only architecture. For production applications, consider:
  - Moving GitHub API requests to a backend service that safely stores the token and proxies requests.
  - Rate limiting and caching requests on the server to avoid hitting GitHub limits.

## Files of interest

- `App.tsx` — main UI and orchestration.
- `services/githubService.ts` — fetches repository tree and file contents from GitHub.
- `services/geminiService.ts` — calls Gemini (`@google/genai`) and enforces response schema.
- `types.ts` — TypeScript interfaces for files, tree nodes, suggestions, and review results.
- `components/*` — small UI components (Loader, Icons, Alert).

## Scripts

- `npm run dev` — start Vite development server
- `npm run build` — build for production
- `npm run preview` — preview production build

## Dependencies

Primary dependencies are listed in `package.json`:

- react, react-dom
- @google/genai (used to call Gemini model)
- vite (dev server / bundler)

## Troubleshooting

- If repository fetch fails with a 403 or rate-limit error, remove the hardcoded token and create a secure backend proxy with a valid token.
- If Gemini calls fail, check that the Gemini API key is correct and not expired; errors are surfaced in the browser console.

## Next steps / recommended improvements

1. Move GitHub API access to a backend to protect tokens and avoid client-side secrets.
2. Add paging and concurrency control when doing bulk repo analysis to avoid rate limits and long waits.
3. Add unit tests around the tree-building and file-selection logic.

## Short developer notes

- The Gemini response is validated using a response schema in `services/geminiService.ts` and is expected to match `ReviewResult` from `types.ts`.

---

Requirements coverage:

- Create README: Done — replaced `README.md` with a complete project README.
- Make a few short points on how it works: Done — see "How it works (short)" above.
