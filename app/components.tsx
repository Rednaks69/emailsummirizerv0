import React from "react"
import { Type, Brain, Zap } from "lucide-react"

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

export const Wrapper = (props: {
  header: React.ReactNode
  children: React.ReactNode
  footer: React.ReactNode
}) => {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      {props.header}
      <div className="flex-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-background overflow-y-auto py-8 pt-6 hover:scrollbar-thumb-muted-foreground">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-2 xl:grid-cols-3">
          {props.children}
        </div>
      </div>

      {props.footer}
    </div>
  )
}

export const StatsBar = ({
  total,
  currentPage,
  pageCount,
  minScore,
  maxScore,
}: {
  total: number
  currentPage: number
  pageCount: number
  minScore: number
  maxScore: number
}) => {
  return (
    <div className="shrink-0 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{total}</span> emails
          </span>
          <span className="text-border">|</span>
          <span>
            Page{" "}
            <span className="font-medium text-foreground">{currentPage}</span>/
            {pageCount}
          </span>
          {maxScore > 0 && (
            <>
              <span className="text-border">|</span>
              <span>
                Score range{" "}
                <span className="font-medium text-foreground">
                  {maxScore.toFixed(1)}
                </span>
                {" - "}
                <span className="font-medium text-foreground">
                  {minScore.toFixed(1)}
                </span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export const EmailCard = ({
  index,
  from,
  to,
  subject,
  body,
  bm25Score,
  embeddingScore,
  rrfScore,
  activeOrder,
}: {
  index: number
  from: string
  to: string
  subject: string
  body: string
  bm25Score: number
  embeddingScore: number
  rrfScore: number
  activeOrder?: "rrf" | "semantic" | "bm25"
}) => {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          Email #{index + 1}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center font-mono text-xs transition-all",
              activeOrder === "bm25"
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            )}
            title="BM25 Score"
          >
            <Type
              className={cn(
                "mr-1.5 h-3 w-3 transition-all",
                activeOrder === "bm25" ? "text-blue-400" : "text-blue-500"
              )}
            />
            {bm25Score.toFixed(1)}
          </span>
          <span
            className={cn(
              "flex items-center font-mono text-xs transition-all",
              activeOrder === "semantic"
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            )}
            title="Semantic Score"
          >
            <Brain
              className={cn(
                "mr-1.5 h-3 w-3 transition-all",
                activeOrder === "semantic" ? "text-pink-400" : "text-pink-500"
              )}
            />
            {(embeddingScore * 100).toFixed(1)}%
          </span>
          <span
            className={cn(
              "flex items-center font-mono text-xs transition-all",
              activeOrder === "rrf"
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            )}
            title="Final RRF Score"
          >
            <Zap
              className={cn(
                "mr-1.5 h-3 w-3 transition-all",
                activeOrder === "rrf" ? "text-yellow-400" : "text-yellow-500"
              )}
            />
            {(rrfScore * 100).toFixed(1)}
          </span>
        </div>
      </div>
      <div className="space-y-2 px-4 py-3">
        <div className="text-xs">
          <span className="text-muted-foreground">From:</span>{" "}
          <span className="font-medium text-foreground">{from}</span>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">To:</span>{" "}
          <span className="font-medium text-foreground">{to}</span>
        </div>
        <div className="pt-1 text-sm font-semibold text-foreground">
          {subject}
        </div>
        <div className="border-t border-border/50 pt-2">
          <p className="text-xs font-extralight whitespace-pre-wrap text-foreground/90">
            {body.trim()}
          </p>
        </div>
      </div>
    </div>
  )
}

export const SearchInput = ({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
}) => {
  return (
    <div className="shrink-0 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit(value)
          }}
        >
          <input
            type="text"
            placeholder="Search emails... (press Enter)"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full max-w-lg rounded-lg border border-input bg-card px-4 py-2.5 text-sm shadow-sm transition-all",
              "placeholder:text-muted-foreground",
              "focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              "hover:border-ring/50"
            )}
          />
        </form>
      </div>
    </div>
  )
}

export const Pagination = ({
  currentPage,
  pageCount,
  onPageChange,
}: {
  currentPage: number
  pageCount: number
  onPageChange: (page: number) => void
}) => {
  return (
    <div className="shrink-0 border-t border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-3">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            "rounded-lg border border-border px-4 py-2 text-sm font-medium transition-all",
            currentPage === 1
              ? "cursor-not-allowed bg-card text-muted-foreground opacity-50"
              : "bg-card text-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === pageCount}
          className={cn(
            "rounded-lg border border-border px-4 py-2 text-sm font-medium transition-all",
            currentPage === pageCount
              ? "cursor-not-allowed bg-card text-muted-foreground opacity-50"
              : "bg-card text-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          Next
        </button>
      </div>
    </div>
  )
}

export const OrderSelector = ({
  value,
  onChange,
}: {
  value: "rrf" | "semantic" | "bm25"
  onChange: (value: "rrf" | "semantic" | "bm25") => void
}) => {
  return (
    <div className="shrink-0 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 pb-1">
        <span className="mr-2 text-xs text-muted-foreground">Order by:</span>
        <button
          onClick={() => onChange("bm25")}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
            value === "bm25"
              ? "border-blue-500/50 bg-blue-500/20 text-blue-300"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Type className="h-3 w-3" />
          BM25
        </button>
        <button
          onClick={() => onChange("semantic")}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
            value === "semantic"
              ? "border-pink-500/50 bg-pink-500/20 text-pink-300"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Brain className="h-3 w-3" />
          Semantic
        </button>
        <button
          onClick={() => onChange("rrf")}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
            value === "rrf"
              ? "border-yellow-500/50 bg-yellow-500/20 text-yellow-300"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Zap className="h-3 w-3" />
          RRF
        </button>
      </div>
    </div>
  )
}
