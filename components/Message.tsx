import type { UIMessage } from "ai"
import ReactMarkdown from "react-markdown"
import { cn } from "@/lib/utils"

const Message = ({
  role,
  part,
}: {
  role: string
  part: UIMessage["parts"]
}) => {
  const isUser = role === "user"
  return (
    <div className={cn("flex w-full", isUser && "justify-end")}>
      <div
        className={cn(
          "transition-colors",
          isUser
            ? "rounded-lg border border-border bg-foreground px-4 py-3 shadow-xs"
            : "rounded-lg border border-border bg-accent px-4 py-3 shadow-sm"
        )}
      >
        {part.map((part, index) => {
          if (part.type === "text") {
            return (
              <div
                key={index}
                className={cn(
                  "prose prose-sm max-w-none",
                  // Apply prose-invert only for the assistant (dark purple background)
                  // and explicitly target paragraphs/headings if needed
                  !isUser
                    ? "prose text-black dark:text-white dark:prose-invert"
                    : "text-white dark:text-black"
                )}
              >
                <ReactMarkdown>{part.text}</ReactMarkdown>
              </div>
            )
          }
        })}
      </div>
    </div>
  )
}

export default Message
