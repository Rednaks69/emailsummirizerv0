import { google } from "@ai-sdk/google"
import {
  convertToModelMessages,
  streamText,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai"

import * as helpers from "../system/agent-tool-helpers"

import z from "zod"

export const POST = async (req: Request): Promise<Response> => {
  const body: { messages: UIMessage[] } = await req.json()
  const { messages } = body

  const result = streamText({
    model: google("gemini-3.5-flash-lite"),
    messages: await convertToModelMessages(messages),
    system: `
      You are a helpful assistant with a toolkit of small utility
      functions for text processing, validation, hashing, dates,
      web/HTTP, code analysis, and document parsing.

      You have access to the following tools:
      - estimateTokens
      - truncateToTokenBudget
      - chunkText
      - stripHtml
      - normalizeWhitespace
      - extractSentences
      - textSimilarity
      - extractUrls
      - extractEmails
      - slugify
      - isValidUrl
      - isValidEmail
      - sanitizeFilename
      - safeJsonParse
      - stripCodeFences
      - hashContent
      - generateId
      - relativeTime
      - isWithinLastHours
      - fetchJson
      - getDomain
      - parseUnifiedDiffStats
      - detectLanguage
      - extractCodeBlocks
      - parseArxivId
      - guessTitle
      - extractReferenceLines

      Use these tools instead of doing text processing, validation,
      hashing, or web fetches yourself in prose. Always call the
      relevant tool rather than guessing at a result.
    `,
    // TODO: add the tools to the streamText call,
    tools: {
      estimateTokens: tool({
        description: "Roughly estimate the number of tokens in a piece of text",
        inputSchema: z.object({
          text: z.string().describe("The text to estimate token count for"),
        }),
        execute: async ({ text }) => {
          return helpers.estimateTokens(text)
        },
      }),
      truncateToTokenBudget: tool({
        description:
          "Truncate text to fit within a max token budget, preserving whole words",
        inputSchema: z.object({
          text: z.string().describe("The text to truncate"),
          maxTokens: z
            .number()
            .describe("The maximum number of tokens allowed"),
        }),
        execute: async ({ text, maxTokens }) => {
          return helpers.truncateToTokenBudget(text, maxTokens)
        },
      }),
      chunkText: tool({
        description:
          "Split long text into overlapping chunks for embedding or RAG pipelines",
        inputSchema: z.object({
          text: z.string().describe("The text to chunk"),
          chunkSize: z
            .number()
            .optional()
            .describe("The size in characters of each chunk (default 1000)"),
          overlap: z
            .number()
            .optional()
            .describe(
              "The number of overlapping characters between chunks (default 150)"
            ),
        }),
        execute: async ({ text, chunkSize, overlap }) => {
          return helpers.chunkText(text, chunkSize, overlap)
        },
      }),
      stripHtml: tool({
        description:
          "Strip HTML tags from a string, returning cleaned plain text",
        inputSchema: z.object({
          html: z.string().describe("The HTML content to strip"),
        }),
        execute: async ({ html }) => {
          return helpers.stripHtml(html)
        },
      }),
      normalizeWhitespace: tool({
        description:
          "Collapse and normalize messy whitespace and newlines in a string",
        inputSchema: z.object({
          text: z.string().describe("The text to normalize"),
        }),
        execute: async ({ text }) => {
          return helpers.normalizeWhitespace(text)
        },
      }),
      extractSentences: tool({
        description:
          "Extract the first N sentences from a piece of text as a cheap preview or summary",
        inputSchema: z.object({
          text: z.string().describe("The text to extract sentences from"),
          count: z
            .number()
            .optional()
            .describe("The number of sentences to extract (default 3)"),
        }),
        execute: async ({ text, count }) => {
          return helpers.extractSentences(text, count)
        },
      }),
      textSimilarity: tool({
        description:
          "Compute a word-overlap similarity score (0 to 1) between two pieces of text",
        inputSchema: z.object({
          a: z.string().describe("The first text"),
          b: z.string().describe("The second text"),
        }),
        execute: async ({ a, b }) => {
          return helpers.textSimilarity(a, b)
        },
      }),
      extractUrls: tool({
        description: "Extract all unique URLs found in a piece of text",
        inputSchema: z.object({
          text: z.string().describe("The text to extract URLs from"),
        }),
        execute: async ({ text }) => {
          return helpers.extractUrls(text)
        },
      }),
      extractEmails: tool({
        description:
          "Extract all unique email addresses found in a piece of text",
        inputSchema: z.object({
          text: z.string().describe("The text to extract email addresses from"),
        }),
        execute: async ({ text }) => {
          return helpers.extractEmails(text)
        },
      }),
      slugify: tool({
        description: "Convert a string into a URL/filename-safe slug",
        inputSchema: z.object({
          text: z.string().describe("The text to slugify"),
        }),
        execute: async ({ text }) => {
          return helpers.slugify(text)
        },
      }),
      isValidUrl: tool({
        description:
          "Check whether a string is a well-formed absolute http(s) URL",
        inputSchema: z.object({
          value: z.string().describe("The string to validate as a URL"),
        }),
        execute: async ({ value }) => {
          return helpers.isValidUrl(value)
        },
      }),
      isValidEmail: tool({
        description: "Check whether a string is a well-formed email address",
        inputSchema: z.object({
          value: z
            .string()
            .describe("The string to validate as an email address"),
        }),
        execute: async ({ value }) => {
          return helpers.isValidEmail(value)
        },
      }),
      sanitizeFilename: tool({
        description:
          "Sanitize a string into a safe filename, removing unsafe characters",
        inputSchema: z.object({
          name: z
            .string()
            .describe("The raw string to sanitize into a filename"),
        }),
        execute: async ({ name }) => {
          return helpers.sanitizeFilename(name)
        },
      }),
      safeJsonParse: tool({
        description:
          "Safely parse a JSON string, returning success/data or an error message instead of throwing",
        inputSchema: z.object({
          input: z.string().describe("The JSON string to parse"),
        }),
        execute: async ({ input }) => {
          return helpers.safeJsonParse(input)
        },
      }),
      stripCodeFences: tool({
        description:
          "Strip surrounding markdown code fences (```) from a string, returning the inner content",
        inputSchema: z.object({
          text: z
            .string()
            .describe("The text that may be wrapped in code fences"),
        }),
        execute: async ({ text }) => {
          return helpers.stripCodeFences(text)
        },
      }),
      hashContent: tool({
        description:
          "Compute a deterministic SHA-256 hash of a string, for deduplication or fingerprinting",
        inputSchema: z.object({
          content: z.string().describe("The content to hash"),
        }),
        execute: async ({ content }) => {
          return helpers.hashContent(content)
        },
      }),
      generateId: tool({
        description:
          "Generate a random, collision-resistant id, optionally with a prefix",
        inputSchema: z.object({
          prefix: z
            .string()
            .optional()
            .describe("An optional prefix to prepend to the generated id"),
        }),
        execute: async ({ prefix }) => {
          return helpers.generateId(prefix)
        },
      }),
      relativeTime: tool({
        description:
          'Convert an ISO date string into a human-readable relative time (e.g. "3 hours ago")',
        inputSchema: z.object({
          isoDate: z.string().describe("The ISO date string to convert"),
        }),
        execute: async ({ isoDate }) => {
          return helpers.relativeTime(new Date(isoDate))
        },
      }),
      isWithinLastHours: tool({
        description:
          "Check whether an ISO date falls within the last N hours from now",
        inputSchema: z.object({
          isoDate: z.string().describe("The ISO date string to check"),
          hours: z.number().describe("The number of hours to look back"),
        }),
        execute: async ({ isoDate, hours }) => {
          return helpers.isWithinLastHours(new Date(isoDate), hours)
        },
      }),
      fetchJson: tool({
        description:
          "Fetch a URL and parse the response as JSON, with a timeout and error handling",
        inputSchema: z.object({
          url: z.string().describe("The URL to fetch"),
          timeoutMs: z
            .number()
            .optional()
            .describe(
              "The timeout in milliseconds before aborting (default 10000)"
            ),
        }),
        execute: async ({ url, timeoutMs }) => {
          return helpers.fetchJson(url, { timeoutMs })
        },
      }),
      getDomain: tool({
        description:
          "Extract the hostname/domain from a URL, without the www prefix",
        inputSchema: z.object({
          url: z.string().describe("The URL to extract the domain from"),
        }),
        execute: async ({ url }) => {
          return helpers.getDomain(url)
        },
      }),
      parseUnifiedDiffStats: tool({
        description:
          "Parse a unified diff string into per-file addition/deletion line counts",
        inputSchema: z.object({
          diff: z.string().describe("The unified diff text to parse"),
        }),
        execute: async ({ diff }) => {
          return helpers.parseUnifiedDiffStats(diff)
        },
      }),
      detectLanguage: tool({
        description:
          "Guess a source file's programming language from its filename extension",
        inputSchema: z.object({
          filename: z
            .string()
            .describe("The filename to detect the language of"),
        }),
        execute: async ({ filename }) => {
          return helpers.detectLanguage(filename)
        },
      }),
      extractCodeBlocks: tool({
        description:
          "Extract fenced code blocks and their language tags from a piece of text",
        inputSchema: z.object({
          text: z.string().describe("The text to extract code blocks from"),
        }),
        execute: async ({ text }) => {
          return helpers.extractCodeBlocks(text)
        },
      }),
      parseArxivId: tool({
        description: "Parse an arXiv identifier out of a URL or raw string",
        inputSchema: z.object({
          input: z
            .string()
            .describe("The URL or string containing an arXiv id"),
        }),
        execute: async ({ input }) => {
          return helpers.parseArxivId(input)
        },
      }),
      guessTitle: tool({
        description:
          "Guess a document title from raw text by finding the first short non-empty line",
        inputSchema: z.object({
          rawText: z.string().describe("The raw document text"),
          maxWords: z
            .number()
            .optional()
            .describe(
              "The maximum number of words a title line can have (default 25)"
            ),
        }),
        execute: async ({ rawText, maxWords }) => {
          return helpers.guessTitle(rawText, maxWords)
        },
      }),
      extractReferenceLines: tool({
        description:
          "Extract likely citation/reference lines from academic paper text",
        inputSchema: z.object({
          text: z
            .string()
            .describe("The paper text to extract references from"),
        }),
        execute: async ({ text }) => {
          return helpers.extractReferenceLines(text)
        },
      }),
    },

    stopWhen: stepCountIs(10),
  })

  return result.toUIMessageStreamResponse()
}
