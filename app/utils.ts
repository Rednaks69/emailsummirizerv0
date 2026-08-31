import path from "node:path"
import fs from "node:fs/promises"

export type Email = {
  id: string
  from: string
  to: string
  subject: string
  body: string
  timestamp: string
  threadId?: string
  inReplyTo?: string
  refrences?: string
  labels?: string[]
  arcId?: string
  phaseId?: number
}

export const loadEmails = async () => {
  const EMAILS_LOCATION = path.resolve(process.cwd(), "datasets/emails.json")
  const content = await fs.readFile(EMAILS_LOCATION, "utf8")
  const emails: Email[] = JSON.parse(content)
  return emails
}

const rrf_k = 60

export function reciprocalRankFusion(
  rankings: { email: Email; score: number }[][]
): { email: Email; score: number }[] {
  const rrfScore = new Map<string, number>()
  const documentMap = new Map<string, { email: Email; score: number }>()

  rankings.forEach((ranking) => {
    ranking.forEach((doc, rank) => {
      const currentScore = rrfScore.get(doc.email.id) || 0

      const contribution = 1 / (rrf_k + rank)
      rrfScore.set(doc.email.id, currentScore + contribution)
      documentMap.set(doc.email.id, doc)
    })
  })
  return Array.from(rrfScore.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([emailId, score]) => ({
      email: documentMap.get(emailId)!.email,
      score,
    }))
  // .filter((reulst) => reulst.score > 0.00801)
}
