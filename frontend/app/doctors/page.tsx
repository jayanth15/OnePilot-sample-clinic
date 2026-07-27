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

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

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
  slot_duration_minutes: number
  is_active: boolean
}

type FormState = {
  name: string
  speciality: string
  qualification: string
  consultation_fee: number
  languages: string
  is_active: boolean
  availability: { enabled: boolean; start: string; end: string }[]
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null)
  const [saving, setSaving] = useState(false)

  const defaultForm = (): FormState => ({
    name: "",
    speciality: "",
    qualification: "",
    consultation_fee: 0,
    languages: "",
    is_active: true,
    availability: DAYS.map(() => ({ enabled: false, start: "09:00", end: "17:00" })),
  })

  const [form, setForm] = useState<FormState>(defaultForm())

  function loadDoctors() {
    setLoading(true)
    setError(null)
    apiFetch<Doctor[]>("/api/v1/doctors")
      .then(setDoctors)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadDoctors() }, [])

  async function openAddModal() {
    setEditingDoctor(null)
    setForm(defaultForm())
    setShowModal(true)
  }

  async function openEditModal(d: Doctor) {
    setEditingDoctor(d)
    setForm({
      name: d.name,
      speciality: d.speciality,
      qualification: d.qualification,
      consultation_fee: d.consultation_fee,
      languages: d.languages || "",
      is_active: d.is_active,
      availability: DAYS.map(() => ({ enabled: false, start: "09:00", end: "17:00" })),
    })
    try {
      const avail: DaySlot[] = await apiFetch(`/api/v1/doctors/${d.id}/availability`)
      setForm((prev) => ({
        ...prev,
        availability: DAYS.map((_, i) => {
          const slot = avail.find((a) => a.day_of_week === i && a.is_active)
          return slot
            ? { enabled: true, start: slot.start_time, end: slot.end_time }
            : { enabled: false, start: "09:00", end: "17:00" }
        }),
      }))
    } catch {
      // no availability fetched, keep defaults
    }
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body = {
        name: form.name,
        speciality: form.speciality,
        qualification: form.qualification,
        consultation_fee: form.consultation_fee,
        languages: form.languages,
        is_active: form.is_active,
      }
      let doctorId: number

      if (editingDoctor) {
        await apiFetch(`/api/v1/doctors/${editingDoctor.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
        doctorId = editingDoctor.id
      } else {
        const created: Doctor = await apiFetch("/api/v1/doctors", {
          method: "POST",
          body: JSON.stringify(body),
        })
        doctorId = created.id
      }

      const availability = form.availability
        .map((a, i) => (a.enabled ? { day_of_week: i, start_time: a.start, end_time: a.end, slot_duration_minutes: 20, is_active: true } : null))
        .filter(Boolean) as DaySlot[]

      await apiFetch(`/api/v1/doctors/${doctorId}/availability`, {
        method: "PUT",
        body: JSON.stringify(availability),
      })

      setShowModal(false)
      loadDoctors()
    } catch {
      alert("Failed to save doctor")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(d: Doctor) {
    try {
      await apiFetch(`/api/v1/doctors/${d.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !d.is_active }),
      })
      loadDoctors()
    } catch {
      alert("Failed to toggle status")
    }
  }

  function toggleDay(i: number) {
    setForm((prev) => ({
      ...prev,
      availability: prev.availability.map((d, j) =>
        j === i ? { ...d, enabled: !d.enabled } : d
      ),
    }))
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 flex-col gap-4 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
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
            <p className="text-destructive text-lg">Failed to load doctors</p>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button onClick={loadDoctors}>Retry</Button>
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
            <h1 className="text-2xl font-bold">Doctors</h1>
            <Button onClick={openAddModal}>Add Doctor</Button>
          </div>

          {doctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-lg text-muted-foreground">No doctors registered</p>
              <p className="text-sm text-muted-foreground mt-1">Add your first doctor to get started</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {doctors.map((d) => (
                <Card key={d.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{d.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{d.speciality}</p>
                      </div>
                      <span className={`inline-block size-2.5 rounded-full ${d.is_active ? "bg-green-500" : "bg-red-500"}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Qualification: </span>
                      {d.qualification}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Fee: </span>₹{d.consultation_fee}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Languages: </span>
                      {d.languages || "\u2014"}
                    </div>
                    <div className="flex flex-wrap gap-1 pt-2">
                      <Button size="xs" variant={d.is_active ? "secondary" : "default"} onClick={() => toggleActive(d)}>
                        {d.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button size="xs" variant="outline" onClick={() => openEditModal(d)}>Edit</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-auto">
              <CardHeader>
                <CardTitle>{editingDoctor ? "Edit Doctor" : "Add Doctor"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Name</label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Speciality</label>
                  <Input value={form.speciality} onChange={(e) => setForm((p) => ({ ...p, speciality: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Qualification</label>
                  <Input value={form.qualification} onChange={(e) => setForm((p) => ({ ...p, qualification: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Fee (₹)</label>
                  <Input type="number" value={form.consultation_fee} onChange={(e) => setForm((p) => ({ ...p, consultation_fee: Number(e.target.value) }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Languages (comma separated)</label>
                  <Input value={form.languages} onChange={(e) => setForm((p) => ({ ...p, languages: e.target.value }))} />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Working Days & Hours</label>
                  <p className="text-xs text-muted-foreground">Click a day to toggle, then set hours</p>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day, i) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          form.availability[i].enabled
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                  {form.availability.some((a) => a.enabled) && (
                    <div className="grid gap-2 mt-1">
                      {form.availability.map((a, i) =>
                        a.enabled ? (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="w-8 font-medium">{DAYS[i]}</span>
                            <Input
                              type="time"
                              value={a.start}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  availability: prev.availability.map((d, j) =>
                                    j === i ? { ...d, start: e.target.value } : d
                                  ),
                                }))
                              }
                              className="w-28"
                            />
                            <span className="text-muted-foreground">to</span>
                            <Input
                              type="time"
                              value={a.end}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  availability: prev.availability.map((d, j) =>
                                    j === i ? { ...d, end: e.target.value } : d
                                  ),
                                }))
                              }
                              className="w-28"
                            />
                          </div>
                        ) : null
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-between pt-2">
                  <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button disabled={saving || !form.name} onClick={handleSave}>
                    {saving ? "Saving..." : editingDoctor ? "Update" : "Add"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
