# emailsummirizerv1

AI-powered email search and question-answering assistant (v1).

**Goal:** Let a user ask questions about their emails in natural language, then return grounded answers drawn from an email corpus — powered by a hybrid keyword + semantic search pipeline and an LLM chat layer.

## What it does

1. **Hybrid email search (BM25 + embeddings, fused with RRF)**
   - Keyword search via BM25 (`okapibm25`) over `${subject} ${body}` per email.
   - Semantic search via Gemini `gemini-embedding-001` embeddings cached to `data/emails_google.json`.
   - The two rankings are merged with Reciprocal Rank Fusion (`reciprocalRankFusion` in `app/utils.ts`) into a single ranked result list.

2. **Chat Q&A over emails**
   - `app/api/chat/route.ts` (POST) receives chat messages, asks Gemini to produce search keywords from the last user message, runs the dual search, returns the top 5 emails as a `data-emails` stream part, then runs a second `streamText` call to generate an answer that must cite sources by email subject.

3. **Email viewer**
   - `app/EmailViewer.tsx` lists the email corpus in pages (GET `/api/chat?page=..&pageSize=..`) and overlays search results when a search is in progress. Resizable split-pane layout: ~60% email list / ~40% chat.

4. **Agent toolkit utilities (`app/system/agent-tool-helpers.ts`)**
   - ~60 dependency-light helper functions grouped by category (text processing, validation/sanitization, async control flow, caching, hashing/IDs, dates/times, array/object utilities, HTTP/web, code/git, document parsing, structured output). Registered as AI SDK tools for the agent.

5. **Sandboxed file-system tools (`app/system/file-system-functionality.ts`)**
   - `writeFile`, `readFile`, `deletePath`, `listDirectory`, `createDirectory`, `exists`, `searchFiles` — all bound to a confined `BASE_DIR` (`data/file-system-db.local`) via path validation.

6. **Persistent embedding cache**
   - Embeddings are computed in chunks of 90 and saved to `data/emails_google.json` so they are not recomputed on every request.

## Data

- `datasets/emails.json`: synthetic email corpus (~1,900+ emails, several threads, each tagged with `id`, `threadId`, `from`, `to`, `subject`, `body`, `timestamp`, optional `arcId`/`phaseId` for organizing, e.g. "house_purchase"). Loaded by `loadEmails` in `app/utils.ts`.
- `data/.gitkeep`, `data/file-system-db.local/`: runtime data dirs.

## Tech stack

- Next.js 16 (App Router, React Server Components + client hydration) / TypeScript strict
- Vercel AI SDK (`ai`, `@ai-sdk/google`) — Gemini 3.5 Flash Lite for chat + `gemini-embedding-001` for embeddings
- `@tanstack/react-query` for server-state caching
- Zod for schema validation; Tailwind CSS v4 + shadcn/ui + `react-resizable-panels`
- `okapibm25` for BM25 scoring; custom Reciprocal Rank Fusion

## Project structure

```
app/
  page.tsx                  # main split-pane layout (email viewer + chat)
  EmailViewer.tsx           # email list + pagination + search-results overlay
  ChatBox.tsx               # chat UI (useChat) + listens for `data-emails` parts
  api/chat/route.ts         # POST chat+search | GET paginated emails
  bm25.ts                   # BM25 search
  embedding.ts              # Gemini embedding cache + cosine search
  search.ts                 # RRF fusion of BM25 + embeddings
  utils.ts                  # loadEmails + RRF
  system/agent-tool-helpers.ts  # ~60 utility tools
  system/file-system-functionality.ts # sandboxed FS tools
  agentTools/               # agent tool route definitions
datasets/emails.json        # email corpus
data/emails_google.json     # embedding cache
```

## Environment

API keys must be supplied via `.env` (e.g. `GOOGLE_GENERATIVE_AI_API_KEY`); the client never receives secrets. The `.env` is gitignored.
