import { searchEmailsViaBM25 } from "./bm25"
import { searchEmailsViaEmbeddings } from "./embedding"
import { reciprocalRankFusion, type Email } from "./utils"

export type EmailWithScore = {
  email: Email
  bm25Score: number
  embeddingScore: number
  rrfScore: number
}

export const searchEmails = async (opts: {
  keywordsForBM25: string[]
  embeddingsQuery: string
}): Promise<EmailWithScore[]> => {
  const [bm25SearchResults, embeddingsSearchResults] = await Promise.all([
    searchEmailsViaBM25(opts.keywordsForBM25),
    searchEmailsViaEmbeddings(opts.embeddingsQuery),
  ])

  const rrfSearchResults = reciprocalRankFusion([
    bm25SearchResults,
    embeddingsSearchResults,
  ])

  const bm25Map = new Map(bm25SearchResults.map((r) => [r.email.id, r.score]))
  const embeddingMap = new Map(
    embeddingsSearchResults.map((r) => [r.email.id, r.score])
  )

  return rrfSearchResults.map((result) => ({
    email: result.email,
    bm25Score: bm25Map.get(result.email.id) ?? 0,
    embeddingScore: embeddingMap.get(result.email.id) ?? 0,
    rrfScore: result.score,
  }))
}
