import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function ConfigurePage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <h1 className="text-2xl font-bold">Configure</h1>
          <p className="text-muted-foreground">Configuration options coming soon.</p>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
