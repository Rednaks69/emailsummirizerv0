"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

export type Email = {
  index: number
  id: string
  from: string
  to: string
  subject: string
  body: string
  timestamp: string
}

type EmailsResponse = {
  emails: Email[]
  stats: {
    total: number
    pageCount: number
    currentPage: number
  }
}

type EmailViewerProps = {
  searchResults: Email[] | null
}

const EmailViewer = ({ searchResults }: EmailViewerProps) => {
  const [page, setPage] = useState(1)

  const { data, isPending, isError, error } = useQuery<EmailsResponse>({
    queryKey: ["emails", page],

    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      })

      const response = await fetch(`/api/chat?${params}`)

      console.log("STATUS:", response.status)

      if (!response.ok) {
        throw new Error(`Failed to fetch emails: ${response.status}`)
      }

      const json = await response.json()

      console.log("EMAIL API RESPONSE:", json)

      return json as EmailsResponse
    },
  })

  console.log("searchResults111", searchResults)

  const emails = searchResults !== null ? searchResults : data?.emails // searchResults  data?.emails

  const isSearching = searchResults !== null

  // IMPORTANT
  if (isPending) {
    return <div>Loading emails...</div>
  }

  if (isError) {
    return (
      <div>
        <p>Failed to load emails</p>
        <p>{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    )
  }

  // Safety guard
  if (!data) {
    return <div>No email data</div>
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* ----------------------------------- */}
      {/* Header */}
      {/* ----------------------------------- */}

      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {isSearching ? "Search Results" : "Emails"}
        </h1>

        {isSearching ? (
          <p className="text-sm text-muted-foreground">
            {searchResults.length} email
            {searchResults.length !== 1 ? "s" : ""} found
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Page {data.stats.currentPage} / {data.stats.pageCount}
          </p>
        )}
      </div>

      {/* ----------------------------------- */}
      {/* Email list */}
      {/* ----------------------------------- */}

      {emails?.length === 0 ? (
        <div className="py-10 text-center">
          <p>{isSearching ? "No emails found." : "No emails."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {emails?.map((email) => (
            <div
              key={email.id}
              className="border-foreground/2d0 rounded-lg border-2 p-0.5"
            >
              <div className="rounded-lg bg-muted/65 p-4">
                <h2 className="font-semibold">{email.subject}</h2>

                <div className="mt-2 text-sm">
                  <p>
                    <strong>From:</strong> {email.from}
                  </p>

                  <p>
                    <strong>To:</strong> {email.to}
                  </p>

                  <p>
                    <strong>Date:</strong> {email.timestamp}
                  </p>
                </div>
              </div>

              <p className="mt-4 px-4 pb-4 text-sm whitespace-pre-wrap">
                {email.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {!isSearching && (
        <div className="mt-6 flex gap-3">
          <button
            className="rounded border px-4 py-2 disabled:opacity-50"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>

          <button
            className="rounded border px-4 py-2 disabled:opacity-50"
            disabled={page >= data.stats.pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export default EmailViewer
