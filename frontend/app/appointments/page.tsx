"use client"

import { useEffect, useState, useCallback } from "react"
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

type Appointment = {
  id: number
  appointment_number: string
  patient_name: string
  patient_id: number
  patient_phone?: string
  doctor_name: string
  doctor_id: number
  speciality: string
  reason: string
  status: string
  start_time: string
  end_time: string
  booking_source: string
  appointment_date: string
  created_at: string
}

type Doctor = {
  id: number
  name: string
  speciality: string
}

type Patient = {
  id: number
  name: string
  phone: string
}

type Slot = {
  start: string
  end: string
  available: boolean
}

function todayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}

function formatTime(hhmm: string) {
  if (!hhmm) return "\u2014"
  const [h, m] = hhmm.split(":")
  const date = new Date()
  date.setHours(Number(h), Number(m))
  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

function getConfirmationDeadline(a: Appointment): { deadline: Date; label: string } {
  const created = new Date(a.created_at)
  const apptDate = new Date(a.appointment_date + "T" + a.start_time + ":00+05:30")
  const defaultDeadline = new Date(created.getTime() + 23 * 60 * 60 * 1000)
  const deadline = defaultDeadline < apptDate ? defaultDeadline : new Date(apptDate.getTime() - 60 * 60 * 1000)
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  if (diff <= 0) return { deadline, label: "Expired" }
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return { deadline, label: `${h}h ${m}m` }
}

const statusStyles: Record<string, string> = {
  booked: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "checked-in": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "no-show": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
}

const statusBadge = (status: string) => {
  const s = status.toLowerCase()
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[s] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"}`}>
      {status}
    </span>
  )
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filterDate, setFilterDate] = useState(todayIST())
  const [filterDoctor, setFilterDoctor] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterSource, setFilterSource] = useState("")
  const [patientSearch, setPatientSearch] = useState("")
  const [showBookModal, setShowBookModal] = useState(false)

  const [newAppointment, setNewAppointment] = useState({
    patient_id: 0,
    doctor_id: 0,
    appointment_date: todayIST(),
    start_time: "",
    reason: "",
  })
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [bookingStep, setBookingStep] = useState<"patient" | "details" | "review">("patient")
  const [submitting, setSubmitting] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  function loadAppointments() {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (filterDate) params.set("date", filterDate)
    if (filterDoctor) params.set("doctor_id", filterDoctor)
    if (filterStatus) params.set("status", filterStatus)
    if (filterSource) params.set("booking_source", filterSource)
    apiFetch<Appointment[]>(`/api/v1/appointments?${params.toString()}`)
      .then(setAppointments)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    apiFetch<Doctor[]>("/api/v1/doctors").then(setDoctors).catch(() => {})
    apiFetch<Patient[]>("/api/v1/patients").then(setPatients).catch(() => {})
  }, [])

  useEffect(() => { loadAppointments() }, [filterDate, filterDoctor, filterStatus, filterSource])

  useEffect(() => {
    if (newAppointment.doctor_id && newAppointment.appointment_date) {
      setLoadingSlots(true)
      apiFetch<Slot[]>(`/api/v1/appointments/slots?doctor_id=${newAppointment.doctor_id}&date=${newAppointment.appointment_date}`)
        .then(setSlots)
        .catch(() => setSlots([]))
        .finally(() => setLoadingSlots(false))
    } else {
      setSlots([])
    }
  }, [newAppointment.doctor_id, newAppointment.appointment_date])

  function resetBookForm() {
    setNewAppointment({ patient_id: 0, doctor_id: 0, appointment_date: todayIST(), start_time: "", reason: "" })
    setBookingStep("patient")
    setPatientSearch("")
  }

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.phone.includes(patientSearch)
  )

  async function handleBook() {
    setSubmitting(true)
    try {
      const token = localStorage.getItem("access_token")
      await fetch("http://localhost:8000/api/v1/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newAppointment),
      })
      setShowBookModal(false)
      resetBookForm()
      loadAppointments()
    } catch {
      alert("Failed to book appointment")
    } finally {
      setSubmitting(false)
    }
  }

  const STATUS_ENDPOINTS: Record<string, string> = {
    confirmed: "confirm",
    cancelled: "cancel",
    "checked-in": "check-in",
    completed: "complete",
    "no-show": "no-show",
  }

  async function changeStatus(id: number, status: string) {
    const ep = STATUS_ENDPOINTS[status]
    if (!ep) { alert(`Unknown status: ${status}`); return }
    try {
      const token = localStorage.getItem("access_token")
      await fetch(`http://localhost:8000/api/v1/appointments/${id}/${ep}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      loadAppointments()
    } catch {
      alert("Failed to update appointment")
    }
  }

  const shortcuts = [
    { label: "Today", date: todayIST(), status: "", doctor: "", source: "" },
    { label: "Upcoming", date: "", status: "booked,confirmed", doctor: "", source: "" },
    { label: "Completed", date: "", status: "completed", doctor: "", source: "" },
    { label: "Cancelled", date: "", status: "cancelled", doctor: "", source: "" },
    { label: "All", date: "", status: "", doctor: "", source: "" },
  ]

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Appointments</h1>
            <Button onClick={() => { resetBookForm(); setShowBookModal(true) }}>
              Book Appointment
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {shortcuts.map((s) => (
              <Button
                key={s.label}
                variant={
                  filterDate === s.date && filterStatus === s.status && filterDoctor === s.doctor
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => {
                  setFilterDate(s.date)
                  setFilterStatus(s.status)
                  setFilterDoctor("")
                  setFilterSource("")
                }}
              >
                {s.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Date</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="h-10 rounded-none border border-b-input bg-transparent px-3 text-sm focus-visible:border-b-ring outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Doctor</label>
              <select
                value={filterDoctor}
                onChange={(e) => setFilterDoctor(e.target.value)}
                className="h-10 rounded-none border border-b-input bg-transparent px-3 text-sm focus-visible:border-b-ring outline-none"
              >
                <option value="">All Doctors</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 rounded-none border border-b-input bg-transparent px-3 text-sm focus-visible:border-b-ring outline-none"
              >
                <option value="">All Statuses</option>
                <option value="booked">Booked</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked-in">Checked In</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no-show">No Show</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Source</label>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="h-10 rounded-none border border-b-input bg-transparent px-3 text-sm focus-visible:border-b-ring outline-none"
              >
                <option value="">All Sources</option>
                <option value="phone">Phone</option>
                <option value="walk-in">Walk-In</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="online">Online</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <p className="text-destructive text-lg">Failed to load appointments</p>
              <p className="text-muted-foreground text-sm">{error}</p>
              <Button onClick={loadAppointments}>Retry</Button>
            </div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-lg text-muted-foreground">No appointments found</p>
              <p className="text-sm text-muted-foreground mt-1">Try changing filters or book a new appointment</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-4 py-3 font-medium">Appt #</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Time</th>
                        <th className="px-4 py-3 font-medium">Patient</th>
                        <th className="px-4 py-3 font-medium">Phone</th>
                        <th className="px-4 py-3 font-medium">Doctor</th>
                        <th className="px-4 py-3 font-medium">Reason</th>
                        <th className="px-4 py-3 font-medium">Source</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Confirm by</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map((a) => (
                        <tr key={a.id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-xs">{a.appointment_number}</td>
                          <td className="px-4 py-3">{a.appointment_date}</td>
                          <td className="px-4 py-3">{formatTime(a.start_time)}</td>
                          <td className="px-4 py-3">{a.patient_name}</td>
                          <td className="px-4 py-3 font-mono text-xs">{a.patient_phone || "\u2014"}</td>
                          <td className="px-4 py-3">{a.doctor_name}</td>
                          <td className="px-4 py-3 max-w-32 truncate">{a.reason}</td>
                          <td className="px-4 py-3">{a.booking_source}</td>
                          <td className="px-4 py-3">{statusBadge(a.status)}</td>
                          <td className="px-4 py-3 text-xs font-mono whitespace-nowrap">
                            {a.status === "booked" ? getConfirmationDeadline(a).label : "\u2014"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {a.status !== "cancelled" && a.status !== "no-show" && a.status !== "completed" && (
                                <>
                                  {a.status === "booked" && (
                                    <Button size="xs" onClick={() => changeStatus(a.id, "confirmed")}>Confirm</Button>
                                  )}
                                  {a.status !== "completed" && (
                                    <Button size="xs" variant="destructive" onClick={() => {
                                      if (confirm(`Cancel appointment ${a.appointment_number}?`)) changeStatus(a.id, "cancelled")
                                    }}>Cancel</Button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {showBookModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-auto">
              <CardHeader>
                <CardTitle>
                  {bookingStep === "patient" ? "Select Patient" : bookingStep === "details" ? "Appointment Details" : "Review & Confirm"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {bookingStep === "patient" && (
                  <>
                    <Input
                      placeholder="Search by name or phone..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                    />
                    <div className="max-h-60 overflow-auto space-y-1">
                      {filteredPatients.map((p) => (
                        <button
                          key={p.id}
                          className={`w-full text-left px-3 py-2 text-sm rounded-none hover:bg-accent ${
                            newAppointment.patient_id === p.id ? "bg-accent font-medium" : ""
                          }`}
                          onClick={() => {
                            setNewAppointment((prev) => ({ ...prev, patient_id: p.id }))
                            setBookingStep("details")
                          }}
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground ml-2 font-mono text-xs">{p.phone}</span>
                        </button>
                      ))}
                      {filteredPatients.length === 0 && (
                        <p className="text-sm text-muted-foreground py-4 text-center">No patients found</p>
                      )}
                    </div>
                  </>
                )}

                {bookingStep === "details" && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase text-muted-foreground">Doctor</label>
                      <select
                        value={newAppointment.doctor_id}
                        onChange={(e) => setNewAppointment((prev) => ({ ...prev, doctor_id: Number(e.target.value), start_time: "" }))}
                        className="h-10 rounded-none border border-b-input bg-transparent px-3 text-sm outline-none"
                      >
                        <option value={0}>Select Doctor</option>
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>{d.name} - {d.speciality}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase text-muted-foreground">Date</label>
                      <input
                        type="date"
                        value={newAppointment.appointment_date}
                        onChange={(e) => setNewAppointment((prev) => ({ ...prev, appointment_date: e.target.value, start_time: "" }))}
                        className="h-10 rounded-none border border-b-input bg-transparent px-3 text-sm outline-none"
                      />
                    </div>
                    {loadingSlots ? (
                      <p className="text-sm text-muted-foreground">Loading slots...</p>
                    ) : slots.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Time Slot</label>
                        <div className="grid grid-cols-3 gap-2">
                          {slots.map((s) => (
                            <button
                              key={s.start}
                              disabled={!s.available}
                              className={`px-3 py-2 text-sm border text-center ${
                                !s.available
                                  ? "border-muted text-muted-foreground cursor-not-allowed opacity-50"
                                  : newAppointment.start_time === s.start
                                  ? "border-primary bg-primary/10 font-medium"
                                  : "border-border hover:bg-accent"
                              }`}
                              onClick={() => setNewAppointment((prev) => ({ ...prev, start_time: s.start }))}
                            >
                              {formatTime(s.start)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : newAppointment.doctor_id ? (
                      <p className="text-sm text-muted-foreground">No slots available</p>
                    ) : null}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase text-muted-foreground">Reason</label>
                      <Input
                        placeholder="Reason for visit"
                        value={newAppointment.reason}
                        onChange={(e) => setNewAppointment((prev) => ({ ...prev, reason: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2 justify-between">
                      <Button variant="outline" onClick={() => setBookingStep("patient")}>Back</Button>
                      <Button disabled={!newAppointment.doctor_id || !newAppointment.start_time} onClick={() => setBookingStep("review")}>
                        Review
                      </Button>
                    </div>
                  </>
                )}

                {bookingStep === "review" && (
                  <>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-muted-foreground">Patient</span>
                        <span className="font-medium">{patients.find((p) => p.id === newAppointment.patient_id)?.name}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-muted-foreground">Doctor</span>
                        <span className="font-medium">{doctors.find((d) => d.id === newAppointment.doctor_id)?.name}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-medium">{newAppointment.appointment_date}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-muted-foreground">Time</span>
                        <span className="font-medium">{newAppointment.start_time}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-muted-foreground">Reason</span>
                        <span className="font-medium">{newAppointment.reason || "\u2014"}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-between">
                      <Button variant="outline" onClick={() => setBookingStep("details")}>Back</Button>
                      <Button disabled={submitting} onClick={handleBook}>
                        {submitting ? "Booking..." : "Confirm Booking"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
              <div className="px-(--card-spacing) pb-(--card-spacing)">
                <Button variant="ghost" className="w-full" onClick={() => { setShowBookModal(false); resetBookForm() }}>
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
