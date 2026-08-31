import { google } from "@ai-sdk/google"
import path from "path"
import fs from "node:fs/promises"
import { type Email, loadEmails } from "./utils"
import { cosineSimilarity, embed, embedMany } from "ai"

export type Embedding = Record<string, number[]>
export const EMBEDD_CACHE_KEY = "emails_google"

const getExistingEmbeddingPath = (cacheKey: string) => {
  return path.resolve(process.cwd(), "data", `${cacheKey}.json`)
}

const saveEmbedding = async (cacheKey: string, embeddingResult: Embedding) => {
  const existingEmbeddingPath = getExistingEmbeddingPath(cacheKey)
  await fs.mkdir(path.dirname(existingEmbeddingPath), { recursive: true })
  await fs.writeFile(existingEmbeddingPath, JSON.stringify(embeddingResult))
}

export const getExistingEmbedding = async (cacheKey: string) => {
  const existingEmbeddingPath = getExistingEmbeddingPath(cacheKey)
  if (!existingEmbeddingPath) return

  try {
    const existingEmbedding = await fs.readFile(existingEmbeddingPath, "utf8")
    return JSON.parse(existingEmbedding)
  } catch (error) {
    console.log("Error reading existing embedding", error)
  }
}

const myEmbeddingModel = google.embeddingModel("gemini-embedding-001")

const embedLostOfText = async (
  emails: Email[]
): Promise<{ id: string; embedding: number[] }[]> => {
  const result_embedLostOfText = await embedMany({
    model: myEmbeddingModel,
    values: emails.map((email) => `${email.subject} ${email.body}`),
    maxRetries: 0,
  })

  return result_embedLostOfText.embeddings.map((embedding, index) => ({
    id: emails[index].id,
    embedding,
  }))
}

export const embedEmails = async (cacheKey: string): Promise<Embedding> => {
  const emails = await loadEmails()
  const existingEmbeddings = await getExistingEmbedding(cacheKey)

  if (existingEmbeddings) {
    return existingEmbeddings
  }

  const embeddings: Embedding = {}
  const chunkSize = 90
  const chunks = []

  for (let i = 0; i < emails.length; i += chunkSize) {
    const chunk = emails.slice(i, i + chunkSize)
    chunks.push(chunk)
  }
  for (const chunk of chunks) {
    const emdedMany_result = await embedLostOfText(chunk)
    emdedMany_result.forEach((embedding) => {
      embeddings[embedding.id] = embedding.embedding
    })
    await saveEmbedding(cacheKey, embeddings)
  }
  return embeddings
}

const embedOnePieceOfText = async (text: string): Promise<number[]> => {
  const result = await embed({
    model: myEmbeddingModel,
    value: text,
  })

  return result.embedding
}

const calculateScore = (
  queryEmbedding: number[],
  embedding: number[]
): number => {
  return cosineSimilarity(queryEmbedding, embedding)
}

export const searchEmailsViaEmbeddings = async (query: string) => {
  const embeddings = await embedEmails(EMBEDD_CACHE_KEY)
  const emails = await loadEmails()
  const emailsById = new Map(emails.map((email) => [email.id, email]))
  const queryEmbedding = await embedOnePieceOfText(query)

  const score = Object.entries(embeddings).map(([key, value]) => {
    return {
      score: calculateScore(queryEmbedding, value),
      email: emailsById.get(key)!,
    }
  })
  // .filter((result) => result.score >= 0.5)

  return score.sort((a, b) => b.score - a.score)
}
