"use client"
import { useEffect, useRef, useState } from "react"
import { FaRegArrowAltCircleDown } from "react-icons/fa"
import { Button } from "@/components/ui/button"

import type { UIMessage } from "ai"
import { useChat } from "@ai-sdk/react"
import Message from "./Message"

import type { Email } from "../app/EmailViewer"

type ChatBoxProps = {
  onSearchResults: (emails: Email[] | null) => void
}

const ChatBox = ({ onSearchResults }: ChatBoxProps) => {
  // input form
  const [input, setInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { messages, sendMessage } = useChat()

  // -----------------------------------------
  // Listen for data-emails
  // -----------------------------------------

  useEffect(() => {
    // Get the latest assistant message
    const latestMessage = messages[messages.length - 1]

    if (!latestMessage) {
      return
    }

    // Find the custom data part
    const emailPart = latestMessage.parts.find(
      (part) => part.type === "data-emails"
    )

    if (emailPart && emailPart.type === "data-emails") {
      console.log("SEARCHED EMAILS:", emailPart.data)

      onSearchResults(emailPart.data as Email[])
    }
  }, [messages, onSearchResults])

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const textarea = textareaRef.current
  useEffect(() => {
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [input])

  const sendingMessage = () => {
    if (!input.trim()) return

    console.log("sending", input)

    sendMessage({
      text: input,
    })

    setInput("")

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handelSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    console.log(input)

    // send input
    sendingMessage()
  }

  // output

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => handelSubmit(e)}
        className="flex w-full items-center gap-1 rounded-lg border border-accent bg-accent p-0.5 dark:border-accent-foreground dark:bg-accent-foreground"
      >
        <textarea
          className="no-scrollbar max-h-40 min-h-20 w-full resize-none rounded-sm bg-white p-2 text-sm text-black focus:outline-none dark:bg-accent dark:text-white dark:placeholder-gray-400"
          value={input}
          placeholder={"ask gemini anything about the emails"}
          ref={textareaRef}
          onChange={(e) => handleInput(e)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <Button
          className="min-h-20 rounded-md bg-sidebar-primary px-5 py-2 font-bold text-white transition hover:bg-sidebar-primary/80 dark:bg-chart-4 hover:dark:bg-chart-4/80"
          type="submit"
        >
          <FaRegArrowAltCircleDown />
        </Button>
      </form>

      {messages.map((message: UIMessage, index: number) => (
        <Message key={message.id} role={message.role} part={message.parts} />
      ))}
    </div>
  )
}

export default ChatBox
