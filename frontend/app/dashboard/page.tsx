"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import apiFetch, { API_BASE } from "@/lib/api"

type Appointment = {
  id: number
  appointment_number: string
  patient_name: string
  patient_id: number
  doctor_name: string
  doctor_id: number
  speciality: string
  reason: string
  status: string
  start_time: string
  end_time: string
  booking_source: string
  date: string
}

type Doctor = {
  id: number
  name: string
  speciality: string
  qualification: string
  consultation_fee: number
  languages: string
  is_active: boolean
}

type DaySlot = {
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

type DoctorSlots = {
  doctor_id: number
  date: string
  timezone: string
  slots: string[]
}

type ClinicSettings = {
  clinic_name: string
  address: string
  phone: string
  whatsapp_number: string
  opening_hours: string
  appointment_reminder_hours: number
}

function todayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

const statusStyles: Record<string, string> = {
  booked: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "checked-in": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "no-show": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
}

const STATUS_ENDPOINTS: Record<string, string> = {
  confirmed: "confirm",
  cancelled: "cancel",
  "checked-in": "check-in",
  completed: "complete",
  "no-show": "no-show",
}

async function updateAppointment(appointmentId: number, status: string) {
  const ep = STATUS_ENDPOINTS[status]
  if (!ep) return
  const token = localStorage.getItem("access_token")
  await fetch(`${API_BASE}/api/v1/appointments/${appointmentId}/${ep}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export default function DashboardPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [availMap, setAvailMap] = useState<Record<number, DaySlot[]>>({})
  const [slotCounts, setSlotCounts] = useState<Record<number, number>>({})
  const [settings, setSettings] = useState<ClinicSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function loadData() {
    setLoading(true)
    setError(null)
    const today = todayIST()
    Promise.all([
      apiFetch<Appointment[]>(`/api/v1/appointments?date=${today}`),
      apiFetch<Doctor[]>("/api/v1/doctors"),
      apiFetch<ClinicSettings>("/api/v1/clinic-settings"),
    ])
      .then(([apps, docs, sets]) => {
        setAppointments(apps)
        setDoctors(docs)
        setSettings(sets)

        docs.forEach((d) => {
          apiFetch<DaySlot[]>(`/api/v1/doctors/${d.id}/availability`).then((rows) => {
            setAvailMap((prev) => ({ ...prev, [d.id]: rows }))
          }).catch(() => {})
          apiFetch<DoctorSlots>(`/api/v1/doctors/${d.id}/slots?date=${today}`).then((res) => {
            setSlotCounts((prev) => ({ ...prev, [d.id]: res.slots.length }))
          }).catch(() => {})
        })
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  const totalToday = appointments.length
  const bookedCount = appointments.filter((a) => a.status === "booked").length
  const confirmedCount = appointments.filter((a) => a.status === "confirmed").length
  const checkedIn = appointments.filter((a) => a.status === "checked-in").length
  const completed = appointments.filter((a) => a.status === "completed").length
  const cancelledOrNoShow = appointments.filter((a) => a.status === "cancelled" || a.status === "no-show").length
  const activeDoctors = doctors.filter((d) => d.is_active).length

  const statusBadge = (status: string) => {
    const s = status.toLowerCase()
    return (
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[s] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"}`}>
        {status}
      </span>
    )
  }

  const actionColor = (action: string) => {
    switch (action) {
      case "confirm": return "default"
      case "check-in": return "secondary"
      case "complete": return "outline"
      case "cancel": return "destructive"
      default: return "ghost"
    }
  }

  const changeStatus = async (id: number, status: string) => {
    try {
      await updateAppointment(id, status)
      loadData()
    } catch {
      alert("Failed to update appointment")
    }
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="grid auto-rows-min gap-4 md:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-xl" />
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
            <p className="text-destructive text-lg">Failed to load dashboard</p>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button onClick={loadData}>Retry</Button>
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
            <div>
              <h1 className="text-2xl font-bold">
                {settings?.clinic_name || "Dashboard"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <Button variant="outline" onClick={loadData}>Refresh</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xs">Total Today</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{totalToday}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xs">Booked</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-amber-600">{bookedCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xs">Confirmed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">{confirmedCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xs">Checked-In</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-purple-600">{checkedIn}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xs">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">{completed}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xs">Cancelled / No-Show</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">{cancelledOrNoShow}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-xs">Active Doctors</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{activeDoctors} / {doctors.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Appointments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {appointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-lg text-muted-foreground">No appointments today</p>
                  <p className="text-sm text-muted-foreground mt-1">Schedule an appointment to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-4 py-3 font-medium">Appt #</th>
                        <th className="px-4 py-3 font-medium">Time (IST)</th>
                        <th className="px-4 py-3 font-medium">Patient</th>
                        <th className="px-4 py-3 font-medium">Doctor</th>
                        <th className="px-4 py-3 font-medium">Speciality</th>
                        <th className="px-4 py-3 font-medium">Reason</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map((a) => (
                        <tr key={a.id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-xs">{a.appointment_number}</td>
                          <td className="px-4 py-3">{formatTime(a.start_time)}</td>
                          <td className="px-4 py-3">{a.patient_name}</td>
                          <td className="px-4 py-3">{a.doctor_name}</td>
                          <td className="px-4 py-3">{a.speciality}</td>
                          <td className="px-4 py-3 max-w-40 truncate">{a.reason}</td>
                          <td className="px-4 py-3">{statusBadge(a.status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {a.status === "booked" && (
                                <Button size="xs" variant={actionColor("confirm")} onClick={() => changeStatus(a.id, "confirmed")}>Confirm</Button>
                              )}
                              {(a.status === "confirmed" || a.status === "booked") && (
                                <Button size="xs" variant={actionColor("check-in")} onClick={() => changeStatus(a.id, "checked-in")}>Check-In</Button>
                              )}
                              {a.status === "checked-in" && (
                                <Button size="xs" variant={actionColor("complete")} onClick={() => changeStatus(a.id, "completed")}>Complete</Button>
                              )}
                              {(a.status !== "completed" && a.status !== "cancelled" && a.status !== "no-show") && (
                                <Button size="xs" variant={actionColor("cancel")} onClick={() => changeStatus(a.id, "cancelled")}>Cancel</Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Doctor Availability Today</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {doctors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-lg text-muted-foreground">No doctors registered</p>
                  <p className="text-sm text-muted-foreground mt-1">Add a doctor to see availability</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-4 py-3 font-medium">Doctor</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Working Hours</th>
                        <th className="px-4 py-3 font-medium">Remaining Slots</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctors.map((d) => {
                        const todayDow = new Date().getDay()
                        const todaySlots = availMap[d.id] || []
                        const todayAvail = todaySlots.find((s) => s.day_of_week === todayDow && s.is_active)
                        const remaining = slotCounts[d.id] ?? null
                        const isOnLeave = d.is_active && !todayAvail
                        const statusText = !d.is_active ? "unavailable" : isOnLeave ? "on-leave" : "working"
                        return (
                          <tr key={d.id} className="border-b hover:bg-muted/30">
                            <td className="px-4 py-3">{d.name}</td>
                            <td className="px-4 py-3">
                              {statusBadge(statusText)}
                            </td>
                            <td className="px-4 py-3">
                              {todayAvail ? `${todayAvail.start_time} - ${todayAvail.end_time}` : "\u2014"}
                            </td>
                            <td className="px-4 py-3">
                              {remaining !== null && d.is_active ? remaining : "\u2014"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
