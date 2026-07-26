import { AppSidebar } from "@/components/app-sidebar"
import { ChatInterface } from "@/components/chat-interface"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function ChatPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <ChatInterface />
      </SidebarInset>
    </SidebarProvider>
  )
}
