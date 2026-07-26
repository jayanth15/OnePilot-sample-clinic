"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  SearchIcon,
  Attachment01Icon,
  AirplaneModeIcon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Message = {
  id: number
  text: string
  sent: boolean
  time: string
  read: boolean
}

type Chat = {
  id: number
  name: string
  avatar: string
  lastMessage: string
  time: string
  unread: number
  online: boolean
  messages: Message[]
}

const chats: Chat[] = [
  {
    id: 1,
    name: "Alice Johnson",
    avatar: "AJ",
    lastMessage: "Sounds great! Let me know when you're free.",
    time: "10:42",
    unread: 2,
    online: true,
    messages: [
      { id: 1, text: "Hey! How's it going?", sent: false, time: "10:30", read: true },
      { id: 2, text: "Pretty good! Working on the new feature.", sent: true, time: "10:32", read: true },
      { id: 3, text: "Oh nice! Which one?", sent: false, time: "10:33", read: true },
      { id: 4, text: "The WhatsApp integration module.", sent: true, time: "10:35", read: true },
      { id: 5, text: "That sounds exciting! Need any help?", sent: false, time: "10:36", read: true },
      { id: 6, text: "I might need some UI feedback later.", sent: true, time: "10:38", read: true },
      { id: 7, text: "Sounds great! Let me know when you're free.", sent: false, time: "10:42", read: true },
    ],
  },
  {
    id: 2,
    name: "Bob Smith",
    avatar: "BS",
    lastMessage: "Sure, I'll check the logs.",
    time: "09:15",
    unread: 0,
    online: false,
    messages: [
      { id: 1, text: "The deployment failed again.", sent: true, time: "09:10", read: true },
      { id: 2, text: "What error are you seeing?", sent: false, time: "09:12", read: true },
      { id: 3, text: "Something about missing env variables.", sent: true, time: "09:13", read: true },
      { id: 4, text: "Sure, I'll check the logs.", sent: false, time: "09:15", read: true },
    ],
  },
  {
    id: 3,
    name: "Charlie Davis",
    avatar: "CD",
    lastMessage: "Perfect, see you tomorrow!",
    time: "Yesterday",
    unread: 0,
    online: true,
    messages: [
      { id: 1, text: "Are we still on for tomorrow?", sent: false, time: "Yesterday", read: true },
      { id: 2, text: "Yes, 10 AM works for me.", sent: true, time: "Yesterday", read: true },
      { id: 3, text: "Perfect, see you tomorrow!", sent: false, time: "Yesterday", read: true },
    ],
  },
]

export function ChatInterface() {
  const [selectedChat, setSelectedChat] = useState<Chat>(chats[0])
  const [input, setInput] = useState("")

  function handleSend() {
    if (!input.trim()) return
    const msg: Message = {
      id: selectedChat.messages.length + 1,
      text: input,
      sent: true,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      read: false,
    }
    setSelectedChat({
      ...selectedChat,
      lastMessage: input,
      time: msg.time,
      messages: [...selectedChat.messages, msg],
    })
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex w-80 flex-col border-r bg-sidebar">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-base">Chats</h2>
        </div>
        <div className="px-3 py-2">
          <div className="relative">
            <HugeiconsIcon icon={SearchIcon} strokeWidth={2} className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search or start new chat" className="pl-9" />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                selectedChat.id === chat.id
                  ? "bg-primary/12 font-medium"
                  : "hover:bg-accent/50"
              }`}
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {chat.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{chat.name}</span>
                  <span className="text-xs text-muted-foreground">{chat.time}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="truncate text-sm text-muted-foreground">{chat.lastMessage}</span>
                  {chat.unread > 0 && (
                    <span className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-3 border-b px-6 py-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {selectedChat.avatar}
          </div>
          <div>
            <p className="font-medium text-sm">{selectedChat.name}</p>
            <p className="text-xs text-muted-foreground">
              {selectedChat.online ? "online" : "offline"}
            </p>
          </div>
        </div>
        <div className="flex-1 space-y-1 overflow-auto p-6">
          {selectedChat.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                  msg.sent
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                }`}
              >
                <p>{msg.text}</p>
                <div className={`mt-1 flex items-center justify-end gap-1 ${msg.sent ? "" : "hidden"}`}>
                  <span className="text-[10px] opacity-70">{msg.time}</span>
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    strokeWidth={2}
                    className={`size-3.5 ${msg.read ? "text-blue-400" : "opacity-60"}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t px-4 py-3">
          <div className="flex items-center gap-2">
            <button className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent">
              <HugeiconsIcon icon={Attachment01Icon} strokeWidth={2} className="size-5" />
            </button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message"
              className="flex-1"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
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
