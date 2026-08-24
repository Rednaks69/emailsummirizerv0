import { searchEmails, type EmailWithScores } from "./search"
import { loadEmails } from "./utils"

export const GET = async (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  const search = url.searchParams.get("search") || ""
  const page = parseInt(url.searchParams.get("page") || "1", 10)
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10)
  const orderBy = url.searchParams.get("orderBy") || "rrf"
  console.log("url", url)

  let emailsWithScores: EmailWithScores[] = []

  if (search) {
    // Perform search and get sorted results
    emailsWithScores = await searchEmails({
      keywordsForBM25: search.split(" ").map((s) => s.trim()),
      embeddingsQuery: search,
    })
  } else {
    // Return all emails with zero scores
    const allEmails = await loadEmails()
    emailsWithScores = allEmails.map((email) => ({
      email,
      bm25Score: 0,
      embeddingScore: 0,
      rrfScore: 0,
    }))
  }

  // Sort by selected score descending
  switch (orderBy) {
    case "bm25":
      emailsWithScores.sort((a, b) => b.bm25Score - a.bm25Score)
      break
    case "semantic":
      emailsWithScores.sort((a, b) => b.embeddingScore - a.embeddingScore)
      break
    case "rrf":
    default:
      emailsWithScores.sort((a, b) => b.rrfScore - a.rrfScore)
      break
  }

  // Calculate stats
  const totalEmails = emailsWithScores.length
  const pageCount = Math.ceil(totalEmails / pageSize)

  // Paginate
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedEmails = emailsWithScores.slice(startIndex, endIndex)

  // Calculate score range for current page
  const pageScores = paginatedEmails.map((e) => e.rrfScore)
  const minScore = pageScores.length > 0 ? Math.min(...pageScores) : 0
  const maxScore = pageScores.length > 0 ? Math.max(...pageScores) : 0

  // Map to response format with indices
  const emailsWithIndices = paginatedEmails.map((item, idx) => ({
    index: startIndex + idx,
    id: item.email.id,
    from: item.email.from,
    to: item.email.to,
    subject: item.email.subject,
    body: item.email.body,
    timestamp: item.email.timestamp,
    bm25Score: item.bm25Score,
    embeddingScore: item.embeddingScore,
    rrfScore: item.rrfScore,
  }))

  return Response.json({
    emails: emailsWithIndices,
    stats: {
      total: totalEmails,
      pageCount,
      currentPage: page,
      minScore,
      maxScore,
    },
  })
}
