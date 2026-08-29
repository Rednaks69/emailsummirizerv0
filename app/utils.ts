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
