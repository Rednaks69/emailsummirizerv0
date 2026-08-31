"use client"

import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

function ResizablePanelGroup({
  className,
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "group relative flex w-px items-start justify-center bg-border ring-offset-background transition-colors after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2 hover:bg-sidebar-primary focus-visible:ring-1 focus-visible:ring-ring/30 focus-visible:outline-hidden aria-[orientation=horizontal]:h-[3px] aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-3 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 dark:bg-amber-600/25 hover:dark:bg-amber-600/80 [&[aria-orientation=horizontal]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 mt-96 flex h-8 w-4 shrink-0 flex-col items-center justify-center gap-1 rounded-full border border-border bg-background shadow-sm transition-colors group-hover:border-primary/50 group-hover:dark:bg-amber-600/80">
          <span className="size-1 shrink-0 rounded-full bg-muted-foreground/70 transition-colors group-hover:bg-primary" />
          <span className="size-1 shrink-0 rounded-full bg-muted-foreground/70 transition-colors group-hover:bg-primary" />
          <span className="size-1 shrink-0 rounded-full bg-muted-foreground/70 transition-colors group-hover:bg-primary" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
