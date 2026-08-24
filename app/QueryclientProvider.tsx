"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

export function QueryclientProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // useState (not a bare `new QueryClient()`) so the client survives
  // re-renders instead of losing its cache every time this component renders
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
