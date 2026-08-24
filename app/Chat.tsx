"use client"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import ReactMarkdown from "react-markdown"

export default function Chat() {
  const [input, setInput] = useState("")
  const { messages, sendMessage, status } = useChat()

  const isGenerating = status === "streaming" || status === "submitted"

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isGenerating) return

    const currentInput = input
    setInput("")

    // Replaced append() with sendMessage()
    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: currentInput }],
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col space-y-2 px-4 py-2.5">
      <form
        onSubmit={onSubmit}
        className="flex items-center justify-center gap-2 px-1"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Gemini something..."
          disabled={isGenerating}
          className="min-h-13 text-sm"
        />
        <Button type="submit" disabled={isGenerating} className="min-h-13">
          Send
        </Button>
      </form>

      <div className="no-scrollbar min-h-[82vh] flex-1 space-y-4 overflow-y-auto rounded-lg border p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg p-3 ${
              m.role === "user"
                ? "ml-auto max-w-[80%] bg-primary text-primary-foreground"
                : "max-w-[80%] bg-muted"
            }`}
          >
            <p className="mb-1 text-sm font-semibold">
              {m.role === "user" ? "You" : "Gemini"}
            </p>
            <div className="whitespace-pre-wrap">
              <ReactMarkdown>
                {m.parts
                  ?.filter((p) => p.type === "text")
                  .map((p) => p.text)
                  .join("")}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
