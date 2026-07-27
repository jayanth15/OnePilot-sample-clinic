"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import apiFetch from "@/lib/api"

type ClinicSettings = {
  clinic_name: string
  address: string
  phone: string
  whatsapp_number: string
  opening_hours: string
  appointment_reminder_hours: number
}

export default function ConfigurePage() {
  const [settings, setSettings] = useState<ClinicSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ClinicSettings>({
    clinic_name: "",
    address: "",
    phone: "",
    whatsapp_number: "",
    opening_hours: "",
    appointment_reminder_hours: 24,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function loadSettings() {
    setLoading(true)
    setError(null)
    apiFetch<ClinicSettings>("/api/v1/clinic-settings")
      .then((data) => {
        setSettings(data)
        setForm(data)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadSettings() }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const updated = await apiFetch<ClinicSettings>("/api/v1/clinic-settings", {
        method: "PATCH",
        body: JSON.stringify(form),
      })
      setSettings(updated)
      setForm(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <Skeleton className="h-8 w-48" />
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
            <p className="text-destructive text-lg">Failed to load settings</p>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button onClick={loadSettings}>Retry</Button>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Configure Clinic</h1>
            {saved && <span className="text-sm text-green-600 font-medium">Saved successfully</span>}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Clinic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Clinic Name</label>
                <Input value={form.clinic_name} onChange={(e) => setForm((p) => ({ ...p, clinic_name: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Address</label>
                <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Phone</label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">WhatsApp Number</label>
                <Input value={form.whatsapp_number} onChange={(e) => setForm((p) => ({ ...p, whatsapp_number: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Opening Hours</label>
                <Input value={form.opening_hours} onChange={(e) => setForm((p) => ({ ...p, opening_hours: e.target.value }))} placeholder="e.g. Mon-Sat 9:00 AM - 7:00 PM" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Appointment Reminder (hours before)</label>
                <Input type="number" value={form.appointment_reminder_hours} onChange={(e) => setForm((p) => ({ ...p, appointment_reminder_hours: Number(e.target.value) }))} />
              </div>
              <Button disabled={saving} onClick={handleSave}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
