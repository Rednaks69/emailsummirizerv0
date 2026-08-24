import * as crypto from 'crypto';

/**
 * ============================================================
 * AGENT TOOL HELPER FUNCTIONS
 * 50 small, dependency-light utilities for AI SDK agent tools.
 * Grouped by category. Each is self-contained and safe to
 * register individually as a tool (or import into tool logic).
 * ============================================================
 */

// ============================================================
// 1. TEXT / STRING PROCESSING (useful for: email summarizer,
//    research papers, bookmark agent)
// ============================================================

/** Rough token estimate (chars/4 heuristic) — good enough for budget checks without a tokenizer dep */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Truncate text to a max token budget, preserving whole words */
export function truncateToTokenBudget(
  text: string,
  maxTokens: number,
): { text: string; truncated: boolean } {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return { text, truncated: false };
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  return {
    text: (lastSpace > 0 ? slice.slice(0, lastSpace) : slice) + '…',
    truncated: true,
  };
}

/** Split long text into overlapping chunks — for embeddings / RAG pipelines */
export function chunkText(
  text: string,
  chunkSize = 1000,
  overlap = 150,
): string[] {
  if (chunkSize <= overlap) throw new Error('chunkSize must exceed overlap');
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - overlap;
  }
  return chunks;
}

/** Strip HTML tags down to plain text (for cleaning scraped/email content) */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collapse whitespace/newlines — normalizing messy scraped or pasted text */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** Extract the first N sentences — cheap extractive summary / preview */
export function extractSentences(text: string, count = 3): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return sentences.slice(0, count).join(' ').trim();
}

/** Word-overlap similarity (Jaccard) between two strings — dedup without embeddings */
export function textSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().match(/\w+/g) ?? []);
  const setB = new Set(b.toLowerCase().match(/\w+/g) ?? []);
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/** Extract all URLs from free text — for email/bookmark link extraction */
export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [];
  return [...new Set(matches)];
}

/** Extract email addresses from free text */
export function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
  return [...new Set(matches)];
}

/** Slugify a string — for generating file/id-safe names from titles */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================
// 2. VALIDATION / SANITIZATION (useful for: any tool taking
//    LLM-generated input before it hits the filesystem/network)
// ============================================================

/** Validate a value is a well-formed absolute URL with http/https scheme */
export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Validate an email address format */
export function isValidEmail(value: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
}

/** Strip a string down to a safe filename (removes path separators, control chars) */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 200);
}

/** Safely parse JSON, returning a discriminated result instead of throwing — critical when parsing LLM output */
export function safeJsonParse<T = unknown>(
  input: string,
): { success: true; data: T } | { success: false; error: string } {
  try {
    return { success: true, data: JSON.parse(input) as T };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
}

/** Strip markdown code fences (```json ... ```) that models often wrap structured output in */
export function stripCodeFences(text: string): string {
  const match = text.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
  return match ? match[1].trim() : text.trim();
}

/** Clamp a number into a [min, max] range — guarding LLM-provided numeric params */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============================================================
// 3. ASYNC CONTROL FLOW (useful for: any tool calling external
//    APIs — Gmail, arXiv, GitHub, model APIs)
// ============================================================

/** Retry an async operation with exponential backoff */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { retries?: number; baseDelayMs?: number; maxDelayMs?: number } = {},
): Promise<T> {
  const { retries = 3, baseDelayMs = 300, maxDelayMs = 5000 } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/** Race a promise against a timeout — prevents a hung tool call from blocking the agent */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = 'Operation timed out',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Run async tasks with a concurrency cap — for batch-fetching many URLs/papers/emails without rate-limiting yourself */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Simple sliding-window rate limiter — self-contained, no external store, good for single-process agents */
export function createRateLimiter(maxCalls: number, windowMs: number) {
  const timestamps: number[] = [];
  return {
    async acquire(): Promise<void> {
      const now = Date.now();
      while (timestamps.length && now - timestamps[0] > windowMs) timestamps.shift();
      if (timestamps.length >= maxCalls) {
        const wait = windowMs - (now - timestamps[0]);
        await new Promise((resolve) => setTimeout(resolve, wait));
        return this.acquire();
      }
      timestamps.push(Date.now());
    },
  };
}

/** Debounce an async function — collapse rapid repeated tool calls (e.g. autosave/search-as-you-type agents) */
export function debounceAsync<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  waitMs: number,
): (...args: Args) => Promise<R> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { resolve: (v: R) => void; reject: (e: unknown) => void }[] = [];
  return (...args: Args) =>
    new Promise<R>((resolve, reject) => {
      pending.push({ resolve, reject });
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const waiters = pending;
        pending = [];
        try {
          const result = await fn(...args);
          waiters.forEach((w) => w.resolve(result));
        } catch (error) {
          waiters.forEach((w) => w.reject(error));
        }
      }, waitMs);
    });
}

// ============================================================
// 4. CACHING (useful for: any tool wrapping an expensive/paid
//    API call — Gemini embeddings, arXiv, GitHub)
// ============================================================

/** Minimal in-memory TTL cache — cheap dedup for repeated tool calls within one agent run */
export function createTTLCache<V>(ttlMs: number) {
  const store = new Map<string, { value: V; expires: number }>();
  return {
    get(key: string): V | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expires) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: V): void {
      store.set(key, { value, expires: Date.now() + ttlMs });
    },
    has(key: string): boolean {
      return this.get(key) !== undefined;
    },
    clear(): void {
      store.clear();
    },
  };
}

/** Wrap an async function so identical concurrent calls share one in-flight promise (dedupe thundering herd) */
export function memoizeAsync<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  keyFn: (...args: Args) => string = (...a) => JSON.stringify(a),
) {
  const inFlight = new Map<string, Promise<R>>();
  return async (...args: Args): Promise<R> => {
    const key = keyFn(...args);
    if (inFlight.has(key)) return inFlight.get(key)!;
    const promise = fn(...args).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };
}

// ============================================================
// 5. HASHING / IDS (useful for: dedup across bookmark/email
//    agent runs, content fingerprinting)
// ============================================================

/** Deterministic content hash — for dedup (same email/paper/bookmark seen twice) */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** Short, human-friendly id derived from content (first 8 hex chars) */
export function shortId(content: string): string {
  return hashContent(content).slice(0, 8);
}

/** Generate a collision-resistant random id (no deps, uses crypto) */
export function generateId(prefix = ''): string {
  const id = crypto.randomBytes(8).toString('hex');
  return prefix ? `${prefix}_${id}` : id;
}

// ============================================================
// 6. DATE / TIME (useful for: email summarizer digest windows,
//    scheduling agents)
// ============================================================

/** Human-readable relative time ("3 hours ago", "in 2 days") */
export function relativeTime(date: Date, from: Date = new Date()): string {
  const diffMs = date.getTime() - from.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const abs = Math.abs(diffMin);
  const suffix = diffMin >= 0 ? 'from now' : 'ago';
  if (abs < 60) return `${abs} min ${suffix}`;
  if (abs < 1440) return `${Math.round(abs / 60)} hr ${suffix}`;
  return `${Math.round(abs / 1440)} day(s) ${suffix}`;
}

/** Check whether a date falls within the last N hours — for "unread in last 24h" style filters */
export function isWithinLastHours(date: Date, hours: number, now: Date = new Date()): boolean {
  return now.getTime() - date.getTime() <= hours * 3600_000;
}

/** Format a Date as ISO date-only string (YYYY-MM-DD) — for grouping/log filenames */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Get start/end Date bounds for "today", "this week" — for digest windows */
export function getDateRange(period: 'today' | 'week' | 'month', now: Date = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  if (period === 'today') start.setHours(0, 0, 0, 0);
  if (period === 'week') start.setDate(start.getDate() - 7);
  if (period === 'month') start.setMonth(start.getMonth() - 1);
  return { start, end };
}

// ============================================================
// 7. ARRAY / OBJECT UTILITIES (general purpose, agent-state
//    shaping, tool result post-processing)
// ============================================================

/** Deduplicate array items by a derived key (e.g. dedupe bookmarks by URL, papers by arXiv id) */
export function dedupeBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Group array items by a derived key — e.g. group emails by sender, papers by category */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

/** Split an array into fixed-size batches — for paginated API calls */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Pick a subset of object keys — trimming large API responses before sending to the model */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) if (key in obj) result[key] = obj[key];
  return result;
}

/** Omit a subset of object keys */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) delete result[key];
  return result;
}

/** Deep-get a nested value by dot path, with a default — safely reading unpredictable API/LLM JSON */
export function getPath<T = unknown>(obj: unknown, path: string, fallback?: T): T {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
  return (value === undefined ? fallback : value) as T;
}

/** Sort objects by a numeric/date field, descending by default — ranking search/tool results */
export function sortByField<T>(items: T[], field: keyof T, order: 'asc' | 'desc' = 'desc'): T[] {
  return [...items].sort((a, b) => {
    const av = a[field] as unknown as number;
    const bv = b[field] as unknown as number;
    return order === 'desc' ? Number(bv) - Number(av) : Number(av) - Number(bv);
  });
}

// ============================================================
// 8. HTTP / WEB (useful for: bookmark agent, research paper
//    agent scraping/fetching)
// ============================================================

/** Fetch with a timeout and automatic JSON/text parsing — thin wrapper around fetch for tool use */
export async function fetchJson<T = unknown>(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<{ success: boolean; status?: number; data?: T; error?: string }> {
  const { timeoutMs = 10000, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const status = res.status;
    if (!res.ok) return { success: false, status, error: `HTTP ${status}` };
    const data = (await res.json()) as T;
    return { success: true, status, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Fetch failed' };
  } finally {
    clearTimeout(timer);
  }
}

/** Extract the domain/hostname from a URL — for grouping bookmarks by site, favicon lookups */
export function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Build a query string from a params object, skipping undefined/null values */
export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** Basic robots-friendly delay helper — sleep between scraping requests to the same host */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// 9. CODE / GIT (useful for: code review agent)
// ============================================================

/** Parse a unified diff string into per-file added/removed line counts */
export function parseUnifiedDiffStats(
  diff: string,
): { file: string; additions: number; deletions: number }[] {
  const files: { file: string; additions: number; deletions: number }[] = [];
  let current: { file: string; additions: number; deletions: number } | null = null;
  for (const line of diff.split('\n')) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      current = { file: fileMatch[1], additions: 0, deletions: 0 };
      files.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) current.additions++;
    if (line.startsWith('-') && !line.startsWith('---')) current.deletions++;
  }
  return files;
}

/** Guess a source file's language from its extension — for routing to the right linter/prompt */
export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript (React)', js: 'JavaScript', jsx: 'JavaScript (React)',
    py: 'Python', go: 'Go', rs: 'Rust', java: 'Java', rb: 'Ruby', php: 'PHP',
    c: 'C', cpp: 'C++', cs: 'C#', md: 'Markdown', json: 'JSON', yml: 'YAML', yaml: 'YAML',
  };
  return map[ext] ?? 'Unknown';
}

/** Strip inline and block comments from source for a cleaner LLM prompt (best-effort, C-style + Python) */
export function stripComments(code: string, style: 'c-style' | 'python' = 'c-style'): string {
  if (style === 'python') return code.replace(/#.*$/gm, '');
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Extract fenced code blocks from an LLM response, with their language tags */
export function extractCodeBlocks(text: string): { language: string; code: string }[] {
  const blocks: { language: string; code: string }[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({ language: match[1] || 'text', code: match[2].trim() });
  }
  return blocks;
}

// ============================================================
// 10. DOCUMENT / PDF PARSING HELPERS (useful for: research
//     papers agent)
// ============================================================

/** Parse an arXiv identifier or URL into a clean id (e.g. "2401.12345") */
export function parseArxivId(input: string): string | null {
  const match = input.match(/(\d{4}\.\d{4,5})(v\d+)?/);
  return match ? match[1] : null;
}

/** Extract a naive title from raw paper text (first non-empty line under N words) */
export function guessTitle(rawText: string, maxWords = 25): string | null {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.split(/\s+/).length <= maxWords) return line;
  }
  return null;
}

/** Extract likely citation/reference lines from paper text (heuristic: starts with [n] or numbered) */
export function extractReferenceLines(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => /^\s*(\[\d+\]|\d+\.)\s+/.test(line))
    .map((line) => line.trim());
}

// ============================================================
// 11. STRUCTURED OUTPUT / SCHEMA HELPERS (useful when tools
//     return data that a next LLM step must consume)
// ============================================================

/** Build a compact, token-cheap summary object for logging/telemetry rather than dumping full payloads */
export function summarizeForLog(obj: Record<string, unknown>, maxLen = 200): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.length > maxLen) {
      out[key] = value.slice(0, maxLen) + `… (${value.length} chars)`;
    } else if (Array.isArray(value)) {
      out[key] = `[${value.length} items]`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Validate that an object has all required string keys non-empty — quick guard before using LLM-extracted fields */
export function assertRequiredFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[],
): { valid: boolean; missing: (keyof T)[] } {
  const missing = fields.filter((f) => obj[f] === undefined || obj[f] === null || obj[f] === '');
  return { valid: missing.length === 0, missing };
}

/** Standard tool-result envelope — mirrors the { success, message } shape from your file-system tools, for consistency across all tools */
export function toolResult<T>(
  success: boolean,
  message: string,
  data?: T,
): { success: boolean; message: string; data?: T } {
  return { success, message, ...(data !== undefined ? { data } : {}) };
}
