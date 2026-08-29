"use client"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

import EmailViewer, { Email } from "./EmailViewer"
import ChatBox from "@/components/ChatBox"
import { useState } from "react"

export default function Page() {
  const [searchResults, setSearchResults] = useState<Email[] | null>(null)

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full min-h-screen w-full"
    >
      <ResizablePanel defaultSize="60%">
        <div className="h-full min-h-screen w-full">
          <EmailViewer searchResults={searchResults} />
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="40%">
        <div className="h-full min-h-screen w-full px-6 pt-8">
          <ChatBox onSearchResults={setSearchResults} />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
