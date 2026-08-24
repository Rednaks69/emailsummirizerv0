import { google } from "@ai-sdk/google"
import {
  convertToModelMessages,
  streamText,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai"

import * as helpers from "../system/agent-tool-helpers"
import * as fsTools from "../system/file-system-functionality"

import z from "zod"

/**
 * ============================================================
 * OPERATION REGISTRY
 * ------------------------------------------------------------
 * tool() execute functions only ever receive JSON-serializable
 * args from the model — they can never receive a real JS
 * function reference. So the higher-order helpers (retry,
 * timeout, concurrency, rate-limit, debounce, cache) can't take
 * "any function" the way they do when you call them from code.
 *
 * Instead, the model selects a known operation BY NAME from this
 * registry, and supplies that operation's args as plain data.
 * The control-flow tool below resolves the name to a real
 * function and wraps it with the relevant helper.
 *
 * Add an entry here any time you want a control-flow tool
 * (retry/timeout/etc.) to be able to target a new operation.
 * ============================================================
 */
const operationRegistry = {
  fetchJson: (args: { url: string; timeoutMs?: number }) =>
    helpers.fetchJson(args.url, { timeoutMs: args.timeoutMs }),
  readFile: (args: { path: string }) =>
    Promise.resolve(fsTools.readFile(args.path)),
  writeFile: (args: { path: string; content: string }) =>
    Promise.resolve(fsTools.writeFile(args.path, args.content)),
  searchFiles: (args: { pattern: string; searchDir?: string }) =>
    Promise.resolve(fsTools.searchFiles(args.pattern, args.searchDir)),
} satisfies Record<string, (args: any) => Promise<unknown>>

type OperationName = keyof typeof operationRegistry
const operationNames = Object.keys(operationRegistry) as [
  OperationName,
  ...OperationName[],
]

/**
 * operationRegistry[name] where name is the OperationName union
 * resolves to a UNION of specific function types (one per
 * operation). Generic helpers like memoizeAsync/debounceAsync
 * need ONE callable signature — TS satisfies that by computing
 * the INTERSECTION of every operation's arg type (contravariance),
 * which nothing can satisfy. This accessor sidesteps that by
 * casting to a single deliberately loose signature up front, so
 * the generic helpers infer Args as [Record<string, any>] instead
 * of an unsatisfiable intersection.
 */
function getOperation(
  name: OperationName
): (args: Record<string, any>) => Promise<unknown> {
  return operationRegistry[name] as (
    args: Record<string, any>
  ) => Promise<unknown>
}

/**
 * Stateful instances live at module scope so they persist across
 * tool calls within the same process/request lifecycle — a
 * fresh rate limiter or cache per call would defeat the purpose.
 */
const sharedRateLimiter = helpers.createRateLimiter(5, 10_000) // 5 calls / 10s
const sharedCache = helpers.createTTLCache<unknown>(60_000) // 60s TTL
type WrappedOperation = (args: Record<string, any>) => Promise<unknown>
const memoizedOperations = new Map<OperationName, WrappedOperation>()
const debouncedOperations = new Map<OperationName, WrappedOperation>()

function getMemoized(name: OperationName) {
  if (!memoizedOperations.has(name)) {
    memoizedOperations.set(
      name,
      helpers.memoizeAsync<[Record<string, any>], unknown>(
        getOperation(name),
        (args) => JSON.stringify(args)
      )
    )
  }
  return memoizedOperations.get(name)!
}

function getDebounced(name: OperationName, waitMs: number) {
  const key = name
  if (!debouncedOperations.has(key)) {
    debouncedOperations.set(
      key,
      helpers.debounceAsync<[Record<string, any>], unknown>(
        getOperation(name),
        waitMs
      )
    )
  }
  return debouncedOperations.get(key)!
}

export const POST = async (req: Request): Promise<Response> => {
  const body: { messages: UIMessage[] } = await req.json()
  const { messages } = body

  const result = streamText({
    model: google("gemini-3.5-flash-lite"),
    messages: await convertToModelMessages(messages),
    system: `
      You are a helpful assistant with control-flow tools that
      wrap other operations: retryWithBackoff, withTimeout,
      mapWithConcurrency, rateLimitedCall, debouncedCall,
      cachedCall, and sleep.

      These tools do not do work themselves — each one takes an
      "operation" name (one of: ${operationNames.join(", ")})
      plus that operation's args, and runs it with retry logic,
      a timeout, concurrency limits, rate limiting, debouncing,
      or caching applied.

      Use sleep to pause between steps when you need to space out
      calls (e.g. respecting an external API's rate limit).

      Prefer rateLimitedCall or cachedCall over calling an
      operation directly when you expect to call the same
      operation many times in a row.
    `,
    tools: {
      sleep: tool({
        description:
          "Pause execution for a given number of milliseconds before continuing",
        inputSchema: z.object({
          ms: z.number().describe("The number of milliseconds to sleep"),
        }),
        execute: async ({ ms }) => {
          await helpers.sleep(ms)
          return { slept: ms }
        },
      }),

      retryWithBackoff: tool({
        description:
          "Run a named operation with exponential backoff retries. Use when an operation might fail transiently (e.g. a flaky network fetch).",
        inputSchema: z.object({
          operation: z
            .enum(operationNames)
            .describe("The name of the registered operation to run"),
          operationArgs: z
            .record(z.string(), z.any())
            .describe("The arguments object to pass to the operation"),
          retries: z
            .number()
            .optional()
            .describe("Max retry attempts (default 3)"),
          baseDelayMs: z
            .number()
            .optional()
            .describe("Initial backoff delay in ms (default 300)"),
          maxDelayMs: z
            .number()
            .optional()
            .describe("Max backoff delay in ms (default 5000)"),
        }),
        execute: async ({
          operation,
          operationArgs,
          retries,
          baseDelayMs,
          maxDelayMs,
        }) => {
          const fn = getOperation(operation as OperationName)
          return helpers.retryWithBackoff(() => fn(operationArgs), {
            retries,
            baseDelayMs,
            maxDelayMs,
          })
        },
      }),

      withTimeout: tool({
        description:
          "Run a named operation but abort it if it takes longer than a given timeout. Use to prevent a single slow call from blocking the agent.",
        inputSchema: z.object({
          operation: z
            .enum(operationNames)
            .describe("The name of the registered operation to run"),
          operationArgs: z
            .record(z.string(), z.any())
            .describe("The arguments object to pass to the operation"),
          timeoutMs: z
            .number()
            .describe("Milliseconds to wait before aborting"),
        }),
        execute: async ({ operation, operationArgs, timeoutMs }) => {
          const fn = getOperation(operation as OperationName)
          return helpers.withTimeout(fn(operationArgs), timeoutMs)
        },
      }),

      mapWithConcurrency: tool({
        description:
          "Run the same named operation over a list of argument sets with a concurrency cap. Use for batch work like fetching many URLs without overloading the target.",
        inputSchema: z.object({
          operation: z
            .enum(operationNames)
            .describe(
              "The name of the registered operation to run for each item"
            ),
          operationArgsList: z
            .array(z.record(z.string(), z.any()))
            .describe("One arguments object per item to process"),
          limit: z.number().describe("Max number of concurrent calls"),
        }),
        execute: async ({ operation, operationArgsList, limit }) => {
          const fn = getOperation(operation as OperationName)
          return helpers.mapWithConcurrency(operationArgsList, limit, (args) =>
            fn(args)
          )
        },
      }),

      rateLimitedCall: tool({
        description:
          "Run a named operation through a shared rate limiter (5 calls per 10 seconds), waiting automatically if the limit is currently exceeded.",
        inputSchema: z.object({
          operation: z
            .enum(operationNames)
            .describe("The name of the registered operation to run"),
          operationArgs: z
            .record(z.string(), z.any())
            .describe("The arguments object to pass to the operation"),
        }),
        execute: async ({ operation, operationArgs }) => {
          await sharedRateLimiter.acquire()
          const fn = getOperation(operation as OperationName)
          return fn(operationArgs)
        },
      }),

      debouncedCall: tool({
        description:
          "Run a named operation through debouncing, collapsing rapid repeated calls to the same operation within the wait window into a single execution.",
        inputSchema: z.object({
          operation: z
            .enum(operationNames)
            .describe("The name of the registered operation to run"),
          operationArgs: z
            .record(z.string(), z.any())
            .describe("The arguments object to pass to the operation"),
          waitMs: z.number().describe("Debounce window in milliseconds"),
        }),
        execute: async ({ operation, operationArgs, waitMs }) => {
          const debounced = getDebounced(operation as OperationName, waitMs)
          return debounced(operationArgs)
        },
      }),

      cachedCall: tool({
        description:
          "Run a named operation with TTL caching (60s) and in-flight de-duplication, so repeated identical calls reuse the previous result instead of re-running the operation.",
        inputSchema: z.object({
          operation: z
            .enum(operationNames)
            .describe("The name of the registered operation to run"),
          operationArgs: z
            .record(z.string(), z.any())
            .describe("The arguments object to pass to the operation"),
        }),
        execute: async ({ operation, operationArgs }) => {
          const cacheKey = `${operation}:${JSON.stringify(operationArgs)}`
          const cached = sharedCache.get(cacheKey)
          if (cached !== undefined) return { cached: true, result: cached }

          const memoized = getMemoized(operation as OperationName)
          const result = await memoized(operationArgs)
          sharedCache.set(cacheKey, result)
          return { cached: false, result }
        },
      }),
    },
    stopWhen: stepCountIs(10),
  })

  return result.toUIMessageStreamResponse()
}
