import BM25 from "okapibm25"

import { loadEmails, type Email } from "./utils"

export const searchEmailsViaBM25 = async (keyQuery: string[]) => {
  const emails: Email[] = await loadEmails()
  const scores: number[] = (BM25 as any)(
    emails.map((email) => `${email.subject} ${email.body}`.toLowerCase()),
    keyQuery.map((query) => query.toLowerCase())
  )
  return scores
    .map((score, index) => ({
      score,
      email: emails[index],
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
}
