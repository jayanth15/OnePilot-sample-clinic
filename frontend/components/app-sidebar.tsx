"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { VersionSwitcher } from "@/components/version-switcher"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Logout03Icon,
  BubbleChatIcon,
  Settings01Icon,
  Settings02Icon,
  DashboardCircleIcon,
  CalendarCheckIn01Icon,
  UserMultipleIcon,
  StethoscopeIcon,
  FileCogIcon,
} from "@hugeicons/core-free-icons"

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: DashboardCircleIcon },
  { title: "Appointments", href: "/appointments", icon: CalendarCheckIn01Icon },
  { title: "Doctors", href: "/doctors", icon: StethoscopeIcon },
  { title: "Patients", href: "/patients", icon: UserMultipleIcon },
  { title: "Chat", href: "/chat", icon: BubbleChatIcon },
  { title: "Configure", href: "/configure", icon: FileCogIcon },
  { title: "Settings", href: "/settings", icon: Settings01Icon },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <VersionSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton isActive={isActive} render={<Link href={item.href} />}>
                      <HugeiconsIcon icon={item.icon} strokeWidth={2} className="size-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => {
            localStorage.removeItem("access_token")
            window.location.href = "/"
          }}
        >
          <HugeiconsIcon icon={Logout03Icon} strokeWidth={2} className="size-4" />
          Logout
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
