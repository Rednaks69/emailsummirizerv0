# Project Context: Next.js App Router + Vercel AI SDK

## Tech Stack & Core Philosophy

- **Framework:** Next.js (App Router, React Server Components)
- **AI Engine:** Vercel AI SDK (`ai` and `@ai-sdk/*` providers)
- **Language:** TypeScript (Strict Mode enabled)
- **Validation:** Zod schemas for API routes and structured AI outputs
- **Styling:** Tailwind CSS + Radix/Shadcn UI
- **Architecture:** Server-first, minimal client-side state, robust error boundaries

---

## Code Generation & Architecture Guidelines

### 1. Vercel AI SDK Best Practices

- **Streaming & Hooks:** Use `streamText` / `streamObject` on the backend (`app/api/*/route.ts`) and pair with `useChat` or `useCompletion` on the client.
- **Structured Outputs:** Always define strict `zod` schemas when using `generateObject` or `streamObject`.
- **Tool Calling:** Declare multi-step tools with explicit Zod parameter descriptions to assist the model in execution.
- **Provider Multi-Tenancy:** Keep model calls modular using `@ai-sdk/google`, `@ai-sdk/openai`, or custom gateways rather than hardcoding client instances inside components.

### 2. Next.js App Router Standards

- **Component Boundaries:** Default to **Server Components** (`RSC`). Explicitly mark files with `'use client'` _only_ when using React hooks (`useState`, `useChat`) or browser events.
- **Route Handlers:** Always export explicit async functions (`POST`, `GET`) from `route.ts`. Use standard Web `Response` or `Response` stream wrappers provided by the AI SDK.
- **Server Actions:** Use Server Actions for mutation workflows; validate all inputs using Zod prior to execution.
- **Environment Variables:** Never expose API keys on the client. Only access sensitive keys (`GOOGLE_GENERATIVE_AI_API_KEY`, etc.) inside server components, actions, or route handlers.

### 3. TypeScript & Type Safety

- **No Implicit `any`:** Never use `any`. Use `unknown` with type guards or Zod parsing.
- **AI Stream Typing:** Ensure streaming payload types match between the API route and client hooks.
- **Generics:** Use explicit generic parameters when wrapping API responses or database handlers.

### 4. Code Review & Refactoring Checklist

When modifying or reviewing files, strictly enforce:

1. Are async route handlers wrapped in try/catch or protected by standard HTTP status codes?
2. Are client components minimal leaf nodes in the render tree?
3. Are UI streams properly handled with cancellation controllers (`AbortController`) where applicable?
4. Is Tailwind code clean, using `clsx` or `cn()` utilities for conditional styling?

---

## Agent Output Instructions

- Keep explanations concise. Lead directly with updated code blocks.
- When generating or updating files, maintain consistent file paths relative to project root (`src/app/`, `src/components/`, `src/lib/`).
- If suggesting changes to dependencies, reference `package.json` updates clearly.
