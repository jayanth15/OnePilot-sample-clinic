"use client"

import { useState, useEffect, useRef } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AirplaneModeIcon,
  BubbleChatIcon,
} from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

import { API_BASE } from "@/lib/api"

type Contact = {
  id: number
  phone: string
  name: string
  last_message: string
}

type HistoryItem = {
  role: string
  content: string
}

type Appointment = {
  id: number
  appointment_number: string
  patient_name: string
  doctor_name: string
  date: string
  start_time: string
  status: string
}

export function ChatInterface() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<HistoryItem[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [aiPaused, setAiPaused] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`
    fetch(`${API_BASE}/api/v1/contacts`, { headers })
      .then((r) => r.json())
      .then((data: Contact[]) => {
        setContacts(data)
        if (data.length > 0 && selectedId === null) {
          setSelectedId(data[0].id)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedId === null) return
    const token = localStorage.getItem("access_token")
    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`
    fetch(`${API_BASE}/api/v1/agent/history?contact_id=${selectedId}`, { headers })
      .then((r) => r.json())
      .then(setMessages)
      .catch(() => setMessages([]))
    fetch(`${API_BASE}/api/v1/appointments?contact_id=${selectedId}`, { headers })
      .then((r) => r.json())
      .then(setAppointments)
      .catch(() => setAppointments([]))
  }, [selectedId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const selectedContact = contacts.find((c) => c.id === selectedId)

  async function handleSend() {
    if (!input.trim() || loading || selectedId === null) return
    const text = input
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: text }])
    setLoading(true)
    try {
      const token = localStorage.getItem("access_token")
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`
      const res = await fetch(`${API_BASE}/api/v1/agent/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text, contact_id: selectedId, pause_ai: aiPaused }),
      })
      const data = await res.json()
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }])
      const ch = { ...headers }
      fetch(`${API_BASE}/api/v1/contacts`, { headers: ch })
        .then((r) => r.json())
        .then(setContacts)
        .catch(() => {})
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Unable to connect to server." }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (iso: string) => {
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
      booked: "bg-blue-100 text-blue-800",
      confirmed: "bg-green-100 text-green-800",
      "checked-in": "bg-purple-100 text-purple-800",
      completed: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
    }
    return (
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${map[s] || "bg-gray-100 text-gray-800"}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="flex h-full">
      <div className="flex w-80 flex-col border-r bg-sidebar">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold text-base">WhatsApp Chats</h2>
        </div>
        <div className="flex-1 overflow-auto">
          {contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                selectedId === c.id
                  ? "bg-primary/12 font-medium"
                  : "hover:bg-accent/50"
              }`}
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {c.name ? c.name.charAt(0).toUpperCase() : "#"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">
                    {c.name || c.phone}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="truncate text-sm text-muted-foreground">
                    {c.last_message || "\u2014"}
                  </span>
                </div>
              </div>
            </button>
          ))}
          {contacts.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No conversations yet.<br />Message the WhatsApp number to start.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {selectedContact
                ? (selectedContact.name
                    ? selectedContact.name.charAt(0).toUpperCase()
                    : "#")
                : "?"}
            </div>
            <div>
              <p className="font-medium text-sm">
                {selectedContact
                  ? selectedContact.name || selectedContact.phone
                  : "Select a chat"}
              </p>
              {selectedContact?.phone && (
                <p className="text-xs text-muted-foreground font-mono">
                  {selectedContact.phone}
                </p>
              )}
            </div>
          </div>
          {selectedContact && (
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant={aiPaused ? "destructive" : "secondary"}
                onClick={() => setAiPaused(!aiPaused)}
              >
                <HugeiconsIcon icon={BubbleChatIcon} strokeWidth={2} className="size-3 mr-1" />
                {aiPaused ? "AI Paused" : "AI Active"}
              </Button>
            </div>
          )}
        </div>

        {selectedContact && appointments.length > 0 && (
          <div className="border-b bg-muted/20 px-6 py-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Upcoming Appointments</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {appointments.map((a) => (
                <div key={a.id} className="shrink-0 rounded-md border bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.appointment_number}</span>
                    {statusBadge(a.status)}
                  </div>
                  <p className="text-muted-foreground">{a.doctor_name} &middot; {a.date} {formatTime(a.start_time)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 space-y-1 overflow-auto p-6">
          {messages.length === 0 && selectedId !== null && (
            <p className="text-center text-sm text-muted-foreground mt-20">
              No messages yet. Send a message to start.
            </p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className="flex items-center gap-1 mb-0.5">
                {msg.role !== "user" && (
                  <span className={`text-[10px] font-medium uppercase ${msg.role === "assistant" ? "text-primary" : "text-muted-foreground"}`}>
                    {msg.role === "assistant" ? "AI" : "Staff"}
                  </span>
                )}
              </div>
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                }`}
              >
                <p>{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="border-t px-4 py-3">
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message"
              className="flex-1"
              disabled={loading || selectedId === null}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading || selectedId === null}
              className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              <HugeiconsIcon icon={AirplaneModeIcon} strokeWidth={2} className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
