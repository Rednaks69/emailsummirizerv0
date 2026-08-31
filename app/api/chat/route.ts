import { google } from "@ai-sdk/google"
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  Output,
  streamText,
  toUIMessageStream,
  UIMessage,
} from "ai"
import z from "zod"
import { searchEmailsViaBM25 } from "@/app/bm25"
import { loadEmails } from "@/app/utils"
import { searchEmails } from "@/app/search"

const getLastUserMessageText = (messages: UIMessage[]) => {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")

  if (!lastUserMessage) {
    return ""
  }

  return lastUserMessage.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
}

export const POST = async (req: Request): Promise<Response> => {
  const body: { messages: UIMessage[] } = await req.json()
  const { messages } = body

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const keywords = await generateText({
        model: google("gemini-3.5-flash-lite"),
        system: `You are a helpful assistant, able to search emails for information.
        Your job is to generate a list of precises keywords which you can use to search for emails.

        Your response should be a list of keywords.

        `,
        output: Output.object({
          schema: z.object({
            keywords: z
              .array(z.string())
              .describe(
                "The list of keywords to search the emails with. Use these for exact termology."
              ),
          }),
        }),
        messages: await convertToModelMessages(messages),
      })

      console.log(keywords.output.keywords)

      // Always searches by BM25 + embeddings together and fuses the two
      // rankings with RRF — there's no single "orderBy" mode to pick between.
      const searchResults = await searchEmails({
        keywordsForBM25: keywords.output.keywords,
        embeddingsQuery: getLastUserMessageText(messages),
      })

      console.log(searchResults)

      const topResults = searchResults.slice(
        0,
        Math.min(5, searchResults.length)
      )

      const emails = topResults.map((result, index) => ({
        index,
        id: result.email.id,
        from: result.email.from,
        to: result.email.to,
        subject: result.email.subject,
        body: result.email.body,
        timestamp: result.email.timestamp,
      }))

      writer.write({
        type: "data-emails",
        data: emails,
      })

      const emailsSnippets = [
        "## Email Snippets",
        ...topResults.map((result, index) => {
          const from = result.email?.from || "Unknown"
          const to = result.email?.to || "Unknown"
          const subject = result.email?.subject || "Unknown"
          const body = result.email?.body || "Unknown"
          return [
            `### Email ${index + 1}`,
            `From: ${from}`,
            `To: ${to}`,
            `Subject: [${subject}](#${subject.replace(/[^a-zA-Z0-9]/g, "-")})`,
            `Body: ${body}`,
          ].join("\n\n")
        }),
        "## Instructions",
        "Based on the email above, answer ther user's question. Always cite your sources using the email subject in mardown format",
      ]

      const result = streamText({
        model: google("gemini-3.5-flash-lite"),
        system: `You are a helpful email assistant that answers questions based on email content.
          You should use the provided emails to answer questions accurately.
          ALWAYS cite sources using markdown formatting with the email subject as the source.
          Be concise but thorough in your explanations. `,
        messages: [
          ...(await convertToModelMessages(messages)),
          {
            role: "user",
            content: emailsSnippets.join("\n\n"),
          },
        ],
      })

      const uiResult = toUIMessageStream({ stream: result.stream })

      writer.merge(uiResult)
    },
  })

  return createUIMessageStreamResponse({
    stream,
  })
}

// export const POST = async (req: Request): Promise<Response> => {
//   const body: { messages: UIMessage[] } = await req.json()
//   const { messages } = body

//   const stream = streamText({
//     model: google("gemini-3.5-flash-lite"),
//     system: `You are a helpful assistant`,
//     messages: await convertToModelMessages(messages),
//   })

//   const uiStream = toUIMessageStream({ stream: stream.stream })

//   return createUIMessageStreamResponse({
//     stream: uiStream,
//   })
// }

export const GET = async (req: Request): Promise<Response> => {
  const url = new URL(req.url)

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10))

  const pageSize = Math.max(
    1,
    parseInt(url.searchParams.get("pageSize") || "20", 10)
  )

  const allEmails = await loadEmails()

  const totalEmails = allEmails.length
  const pageCount = Math.ceil(totalEmails / pageSize)

  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  const paginatedEmails = allEmails.slice(startIndex, endIndex)

  const emails = paginatedEmails.map((email, index) => ({
    index: startIndex + index,
    id: email.id,
    from: email.from,
    to: email.to,
    subject: email.subject,
    body: email.body,
    timestamp: email.timestamp,
  }))

  return Response.json({
    emails,
    stats: {
      total: totalEmails,
      pageCount,
      currentPage: page,
    },
  })
}
