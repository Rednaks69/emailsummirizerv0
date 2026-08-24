import Chat from "@/app/Chat"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

import EmailViewer from "./EmailViewer"

export default function Page() {
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="no-scrollbar h-full min-h-screen w-full overflow-hidden rounded-lg border"
    >
      <ResizablePanel defaultSize="60%">
        <div className="no-scrollbar flex h-full items-center justify-center overflow-hidden p-6">
          <EmailViewer />
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="40%">
        <div className="no-scrollbar flex h-full w-full items-center justify-center overflow-hidden p-6">
          <Chat />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
