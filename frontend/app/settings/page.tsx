"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

const API = "http://localhost:8000"

type Contact = {
  id: number
  phone: string
  name: string
  created_at: string
}

type SettingsData = {
  environment: string
  agent_model: string
  messaging_channel: string
  messaging_mock: boolean
  source_number: string
  session_idle_minutes: number
  contacts: Contact[]
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null)

  useEffect(() => {
    fetch(`${API}/api/v1/settings`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-6 p-6">
          <h1 className="text-2xl font-bold">Settings</h1>

          {data && (
            <>
              <section>
                <h2 className="text-lg font-semibold mb-2">WhatsApp</h2>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-32">Source Number:</span>
                    <span className="font-mono">{data.source_number || "Not configured"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-32">Channel:</span>
                    <span>{data.messaging_channel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-32">Mock Mode:</span>
                    <span>{data.messaging_mock ? "Yes" : "No"}</span>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-2">AI Agent</h2>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-32">Model:</span>
                    <span className="font-mono">{data.agent_model}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-32">Environment:</span>
                    <span>{data.environment}</span>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-2">
                  Contacts
                  <span className="text-muted-foreground text-sm font-normal ml-2">
                    ({data.contacts.length})
                  </span>
                </h2>
                {data.contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contacts yet.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-4 py-2 font-medium">Phone</th>
                          <th className="text-left px-4 py-2 font-medium">Name</th>
                          <th className="text-left px-4 py-2 font-medium">First Seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.contacts.map((c) => (
                          <tr key={c.id} className="border-t">
                            <td className="px-4 py-2 font-mono">{c.phone}</td>
                            <td className="px-4 py-2">{c.name || "\u2014"}</td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {new Date(c.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
