"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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

type Patient = {
  id: number
  name: string
  phone: string
  age: number
  gender: string
  preferred_language: string
  created_at: string
}

export default function PatientsPage() {
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: "", phone: "", age: 0, gender: "Male", preferred_language: "English" })
  const [saving, setSaving] = useState(false)

  function loadPatients() {
    setLoading(true)
    setError(null)
    apiFetch<Patient[]>("/api/v1/patients")
      .then(setPatients)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadPatients() }, [])

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search)
  )

  async function handleAdd() {
    setSaving(true)
    try {
      await apiFetch("/api/v1/patients", {
        method: "POST",
        body: JSON.stringify(form),
      })
      setShowModal(false)
      setForm({ name: "", phone: "", age: 0, gender: "Male", preferred_language: "English" })
      loadPatients()
    } catch {
      alert("Failed to add patient")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Patients</h1>
            <Button onClick={() => setShowModal(true)}>Add Patient</Button>
          </div>

          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <p className="text-destructive text-lg">Failed to load patients</p>
              <p className="text-muted-foreground text-sm">{error}</p>
              <Button onClick={loadPatients}>Retry</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-lg text-muted-foreground">
                {search ? "No patients match your search" : "No patients registered"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search term" : "Add a patient to get started"}
              </p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Phone</th>
                        <th className="px-4 py-3 font-medium">Age</th>
                        <th className="px-4 py-3 font-medium">Gender</th>
                        <th className="px-4 py-3 font-medium">Language</th>
                        <th className="px-4 py-3 font-medium">Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr
                          key={p.id}
                          className="border-b hover:bg-accent/50 cursor-pointer"
                          onClick={() => router.push(`/patients/${p.id}`)}
                        >
                          <td className="px-4 py-3 font-medium">{p.name}</td>
                          <td className="px-4 py-3 font-mono text-xs">{p.phone}</td>
                          <td className="px-4 py-3">{p.age}</td>
                          <td className="px-4 py-3">{p.gender}</td>
                          <td className="px-4 py-3">{p.preferred_language}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(p.created_at).toLocaleDateString("en-IN")}
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

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Add Patient</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Name</label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Phone</label>
                  <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
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
                <div className="flex gap-2 justify-between pt-2">
                  <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button disabled={saving || !form.name || !form.phone} onClick={handleAdd}>
                    {saving ? "Adding..." : "Add Patient"}
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
