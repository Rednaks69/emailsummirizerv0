"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import {
  EmailCard,
  OrderSelector,
  Pagination,
  SearchInput,
  StatsBar,
  Wrapper,
} from "./components"

type OrderBy = "rrf" | "semantic" | "bm25"

type EmailsResponse = {
  emails: Array<{
    index: number
    id: string
    from: string
    to: string
    subject: string
    body: string
    timestamp: string
    bm25Score: number
    embeddingScore: number
    rrfScore: number
  }>
  stats: {
    total: number
    pageCount: number
    currentPage: number
    minScore: number
    maxScore: number
  }
}

const EmailViewer = () => {
  const [inputValue, setInputValue] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [orderBy, setOrderBy] = useState<OrderBy>("rrf")

  const { data, isLoading } = useQuery({
    queryKey: ["emails", search, page, orderBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        page: page.toString(),
        orderBy,
      })
      const res = await fetch(`/api/emails?${params}`)
      return (await res.json()) as EmailsResponse
    },
  })

  const handleSearchSubmit = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  return (
    <Wrapper
      header={
        <>
          <SearchInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSearchSubmit}
          />
          <OrderSelector value={orderBy} onChange={setOrderBy} />
          {isLoading ? (
            <div className="shrink-0 border-b border-border bg-background/80 backdrop-blur-sm">
              <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  Loading...
                </span>
              </div>
            </div>
          ) : data ? (
            <StatsBar
              total={data.stats.total}
              currentPage={data.stats.currentPage}
              pageCount={data.stats.pageCount}
              minScore={data.stats.minScore * 10}
              maxScore={data.stats.maxScore * 10}
            />
          ) : // <div className=""></div>
          null}
        </>
      }
      footer={
        isLoading || !data ? null : (
          <Pagination
            currentPage={page}
            pageCount={data.stats.pageCount}
            onPageChange={setPage}
          />
        )
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Loading emails...
        </div>
      ) : data ? (
        data.emails.map((email) => (
          <EmailCard
            key={email.id}
            index={email.index}
            from={email.from}
            to={email.to}
            subject={email.subject}
            body={email.body}
            bm25Score={email.bm25Score}
            embeddingScore={email.embeddingScore}
            rrfScore={email.rrfScore}
            activeOrder={orderBy}
          />
        ))
      ) : null}
    </Wrapper>
  )
}

export default EmailViewer
