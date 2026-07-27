"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
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

type PatientDetail = {
  id: number
  name: string
  phone: string
  age: number
  gender: string
  preferred_language: string
  created_at: string
  total_appointments: number
  upcoming_count: number
  last_appointment: string | null
}

type Appointment = {
  id: number
  appointment_number: string
  doctor_name: string
  speciality: string
  reason: string
  status: string
  start_time: string
  date: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

const statusBadge = (status: string) => {
  const s = status.toLowerCase()
  const map: Record<string, string> = {
    booked: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "checked-in": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    completed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    "no-show": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${map[s] || "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  )
}

export default function PatientDetailPage() {
  const params = useParams()
  const patientId = Number(params.patient_id)

  const [patient, setPatient] = useState<PatientDetail | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: "", age: 0, gender: "", preferred_language: "" })
  const [saving, setSaving] = useState(false)

  function loadPatient() {
    setLoading(true)
    setError(null)
    Promise.all([
      apiFetch<PatientDetail>(`/api/v1/patients/${patientId}`),
      apiFetch<Appointment[]>(`/api/v1/appointments?patient_id=${patientId}`),
    ])
      .then(([pat, apps]) => {
        setPatient(pat)
        setAppointments(apps)
        setForm({ name: pat.name, age: pat.age, gender: pat.gender, preferred_language: pat.preferred_language })
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadPatient() }, [patientId])

  async function handleSave() {
    setSaving(true)
    try {
      await apiFetch(`/api/v1/patients/${patientId}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      })
      setEditing(false)
      loadPatient()
    } catch {
      alert("Failed to update patient")
    } finally {
      setSaving(false)
    }
  }

  async function changeAppointmentStatus(id: number, status: string) {
    try {
      const token = localStorage.getItem("access_token")
      await fetch(`http://localhost:8000/api/v1/appointments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      })
      loadPatient()
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
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (error || !patient) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
            <p className="text-destructive text-lg">Failed to load patient</p>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button onClick={loadPatient}>Retry</Button>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const upcomingApps = appointments.filter((a) => a.status !== "completed" && a.status !== "cancelled" && a.status !== "no-show")
  const historyApps = appointments.filter((a) => a.status === "completed" || a.status === "cancelled" || a.status === "no-show")

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{patient.name}</h1>
            <Button variant="outline" onClick={() => setEditing(!editing)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card size="sm">
              <CardHeader><CardTitle className="text-xs">Phone</CardTitle></CardHeader>
              <CardContent><p className="font-mono text-sm">{patient.phone}</p></CardContent>
            </Card>
            <Card size="sm">
              <CardHeader><CardTitle className="text-xs">Age</CardTitle></CardHeader>
              <CardContent><p className="text-sm">{patient.age}</p></CardContent>
            </Card>
            <Card size="sm">
              <CardHeader><CardTitle className="text-xs">Gender</CardTitle></CardHeader>
              <CardContent><p className="text-sm">{patient.gender}</p></CardContent>
            </Card>
            <Card size="sm">
              <CardHeader><CardTitle className="text-xs">Language</CardTitle></CardHeader>
              <CardContent><p className="text-sm">{patient.preferred_language}</p></CardContent>
            </Card>
            <Card size="sm">
              <CardHeader><CardTitle className="text-xs">Total Appointments</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{patient.total_appointments}</p></CardContent>
            </Card>
            <Card size="sm">
              <CardHeader><CardTitle className="text-xs">Upcoming</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{patient.upcoming_count}</p></CardContent>
            </Card>
            <Card size="sm">
              <CardHeader><CardTitle className="text-xs">Last Appointment</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm">{patient.last_appointment ? new Date(patient.last_appointment).toLocaleDateString("en-IN") : "\u2014"}</p>
              </CardContent>
            </Card>
          </div>

          {editing && (
            <Card>
              <CardHeader><CardTitle>Edit Patient</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Name</label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Age</label>
                  <Input type="number" value={form.age || ""} onChange={(e) => setForm((p) => ({ ...p, age: Number(e.target.value) }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
                    className="h-10 rounded-none border border-b-input bg-transparent px-3 text-sm outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Preferred Language</label>
                  <Input value={form.preferred_language} onChange={(e) => setForm((p) => ({ ...p, preferred_language: e.target.value }))} />
                </div>
                <Button disabled={saving} onClick={handleSave}>{saving ? "Saving..." : "Save Changes"}</Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Upcoming Appointments</CardTitle></CardHeader>
            <CardContent className="p-0">
              {upcomingApps.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No upcoming appointments</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-4 py-3 font-medium">Appt #</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Time</th>
                        <th className="px-4 py-3 font-medium">Doctor</th>
                        <th className="px-4 py-3 font-medium">Reason</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingApps.map((a) => (
                        <tr key={a.id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-xs">{a.appointment_number}</td>
                          <td className="px-4 py-3">{a.date}</td>
                          <td className="px-4 py-3">{formatTime(a.start_time)}</td>
                          <td className="px-4 py-3">{a.doctor_name}</td>
                          <td className="px-4 py-3 max-w-32 truncate">{a.reason}</td>
                          <td className="px-4 py-3">{statusBadge(a.status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {a.status === "booked" && (
                                <Button size="xs" onClick={() => changeAppointmentStatus(a.id, "confirmed")}>Confirm</Button>
                              )}
                              {(a.status === "confirmed" || a.status === "booked") && (
                                <Button size="xs" variant="secondary" onClick={() => changeAppointmentStatus(a.id, "checked-in")}>Check-In</Button>
                              )}
                              {a.status !== "cancelled" && a.status !== "no-show" && (
                                <Button size="xs" variant="destructive" onClick={() => changeAppointmentStatus(a.id, "cancelled")}>Cancel</Button>
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
            <CardHeader><CardTitle>Booking History</CardTitle></CardHeader>
            <CardContent className="p-0">
              {historyApps.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No appointment history</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-4 py-3 font-medium">Appt #</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Time</th>
                        <th className="px-4 py-3 font-medium">Doctor</th>
                        <th className="px-4 py-3 font-medium">Reason</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyApps.map((a) => (
                        <tr key={a.id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-xs">{a.appointment_number}</td>
                          <td className="px-4 py-3">{a.date}</td>
                          <td className="px-4 py-3">{formatTime(a.start_time)}</td>
                          <td className="px-4 py-3">{a.doctor_name}</td>
                          <td className="px-4 py-3 max-w-32 truncate">{a.reason}</td>
                          <td className="px-4 py-3">{statusBadge(a.status)}</td>
                        </tr>
                      ))}
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
