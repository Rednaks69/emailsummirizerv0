import path from "path"
import { readFile, writeFile } from "fs/promises"
import { cosineSimilarity, embed, embedMany } from "ai"
import { google } from "@ai-sdk/google"
import { existsSync } from "fs"

export type Email = {
  id: string
  from: string
  to: string
  subject: string
  body: string
  timestamp: string
  threadId?: string
  inReplyTo?: string
  references?: string[]
  labels?: string[]
  arcId?: string
  phaseId?: number
}

export const loadEmails = async () => {
  const EMAILS_LOCATION = path.resolve(
    import.meta.dirname,
    "../../../datasets/emails.json"
  )

  const content = await readFile(EMAILS_LOCATION, "utf8")
  console.log(content)

  const emails: Email[] = JSON.parse(content)

  return emails
}

export type Embeddings = Record<string, number[]>

// ----------------------------------------------------------------------
// The path helper
/** 
 * This just builds a file path. Given a cacheKey like "emails-google", 
    it returns something like:
    /your/project/root/data/emails-google.json   
*/

const getExistingEmbeddingsPath = (cacheKey: string) => {
  return path.resolve(process.cwd(), "data", `${cacheKey}.json`)
}

/*
  So this function's whole job is: "turn a cache key into a JSON file path 
  on disk." That's the caching layer — embeddings are expensive to compute
  (they cost API calls), so once computed, they get dumped to a file 
  with this name.
  */
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// Saving embeddings
const saveEmbeddings = async (
  cacheKey: string,
  embeddingsResult: Embeddings
) => {
  const existingEmbeddingsPath = getExistingEmbeddingsPath(cacheKey)

  await writeFile(existingEmbeddingsPath, JSON.stringify(embeddingsResult))
}
/**
 * Takes the Embeddings object
 * (which is Record<string, number[]> — email ID → vector),
 * stringifies it, writes it to that path. Straightforward.
 */
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// Loading existing embeddings (the cache check)
export const getExistingEmbeddings = async (
  cacheKey: string
): Promise<Embeddings | undefined> => {
  const existingEmbeddingsPath = getExistingEmbeddingsPath(cacheKey)

  if (!existsSync(existingEmbeddingsPath)) {
    return
  }

  try {
    const existingEmbeddings = await readFile(existingEmbeddingsPath, "utf8")
    return JSON.parse(existingEmbeddings)
  } catch (error) {
    return
  }
}
/**
 * Compute the file path from the cache key.
 * If the file doesn't exist → return undefined (nothing cached yet).
 * If it exists, try to read + parse it as JSON.
 * If reading/parsing fails for any reason 
(corrupted file, bad JSON) → silently swallow the error 
and return undefined too.

So this function has three possible outcomes: real data, 
undefined (no file), or undefined (broken file). 
The caller can't tell the difference between "not cached" and "cache 
is corrupted" — that's a minor design smell, but not a bug per se.
*/
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// The embedding model instance
const myEmbeddingModel = google.textEmbeddingModel("gemini-embedding-001")
/*
Just instantiates Google's text-embedding-004 model client
once at module load, reused everywhere below
*/
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// embedEmails — the orchestrator
export const embedEmails = async (cacheKey: string): Promise<Embeddings> => {
  const emails = await loadEmails()

  const existingEmbeddings = await getExistingEmbeddings(cacheKey)

  if (existingEmbeddings) {
    return existingEmbeddings
  }
  /*
  This is the "cache-or-compute" pattern:
  - Load all emails from the JSON dataset.
  - Check if we already have embeddings cached under this key.
  - If yes → return them immediately, skip all the expensive API calls.
  */
  const embeddings: Embeddings = {}

  // Chunk the values into batches of 99
  const chunkSize = 20
  const chunks = []
  for (let i = 0; i < emails.length; i += chunkSize) {
    chunks.push(emails.slice(i, i + chunkSize))
  }
  /*
  This splits the full emails array into batches ("chunks") of 99 at a time.
  Why? Because embedding APIs (Google's included) usually 
  cap how many inputs you can send in a single request 
  — 99 is likely just under that model's per-request limit 
  (Google's embedding API commonly limits batches to 100).
  
  emails.slice(i, i + chunkSize) 
  for i = 0, 99, 198, ... produces an array of arrays, 
  e.g. [[email0..98], [email99..197], ...].
  */

  // Process each chunk sequentially
  let processedCount = 0
  for (const chunk of chunks) {
    const embedManyResult = await embedLotsOfText(chunk)

    embedManyResult.forEach((embedding) => {
      embeddings[embedding.id] = embedding.embedding
    })

    processedCount += chunk.length
    await new Promise((resolve) => setTimeout(resolve, 40000))
  }
  /**
   * For each chunk (sequentially, one batch at a time — not in parallel,
   *  probably to respect rate limits):
  - Call embedLotsOfText(chunk) to get back an array of { id, embedding }.
  - Merge each into the embeddings map: embeddings[emailId] = vectorArray.
  - processedCount is incremented but never actually used anywhere
  (no logging, no progress bar) — this is dead code, a leftover 
  from probably a console.log that got commented out.
  */
  await saveEmbeddings(cacheKey, embeddings)

  return embeddings
}
/**
 *
 * Once everything is embedded, write the whole thing to disk under
 * the cache key, then return it.
 *> Summary of embedEmails:
 *> "Give me embeddings for every email.
 *> If I've already computed and saved them before under this cache key,
 *> just hand those back.
 *> Otherwise, batch all emails into groups of 99,
 *> embed each batch via the API, merge results, save to disk, and return."
 *
 */
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// searchEmails — putting it together
export const searchEmails = async (query: string) => {
  const embeddings = await getExistingEmbeddings(EMBED_CACHE_KEY)

  if (!embeddings) {
    throw new Error(
      `Embeddings not yet created under this cache key: ${EMBED_CACHE_KEY}`
    )
  }

  /**
   * Loads the cached embeddings by a fixed key,
   * EMBED_CACHE_KEY = 'emails-google'
   * (defined as a constant elsewhere in the file).
   * If no cache exists → throw.
   * This means embedEmails('emails-google') must have been run at least once
   * before searchEmails will work.
   * There's an implicit dependency here that isn't enforced in code — just by
   * convention.
   */

  const emails = await loadEmails()
  const emailsMap = new Map(emails.map((email) => [email.id, email]))

  /**
   * Loads all emails again (from the JSON file, not from cache —
   * this re-reads and re-parses the whole dataset every search).
   * Builds a Map from email ID → full Email object,
   * so we can look up full email data given just an ID.
   */

  const queryEmbedding = await embedOnePieceOfText(query)

  const scores = Object.entries(embeddings).map(([key, value]) => {
    return {
      score: calculateScore(queryEmbedding, value),
      email: emailsMap.get(key)!,
    }
  })

  return scores.sort((a, b) => b.score - a.score)
}
// ----------------------------------------------------------------------

export const EMBED_CACHE_KEY = "emails-google"

const embedLotsOfText = async (
  emails: Email[]
): Promise<
  {
    id: string
    embedding: number[]
  }[]
> => {
  try {
    const { embeddings } = await embedMany({
      model: myEmbeddingModel,
      values: emails.map((email) => `${email.subject} ${email.body}`),
      maxRetries: 0,
    })

    return embeddings.map((embedding, index) => ({
      id: emails[index]!.id,
      embedding,
    }))
  } catch (error) {
    // console.error(error);
    throw new Error("Not implemented", { cause: error })
  }
}

const embedOnePieceOfText = async (text: string): Promise<number[]> => {
  try {
    const { embedding } = await embed({
      model: myEmbeddingModel,
      value: text,
      maxRetries: 0,
    })
    return embedding
  } catch (error) {
    // console.error(error);
    throw new Error("Not implemented", { cause: error })
  }
}

const calculateScore = (
  queryEmbedding: number[],
  embedding: number[]
): number => {
  const score = cosineSimilarity(queryEmbedding, embedding)

  return score
}
