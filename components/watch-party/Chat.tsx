"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import type { ChatMessage, RoomMember } from "@/hooks/useWatchParty";

interface Props {
  messages: ChatMessage[];
  members: RoomMember[];
  onSend: (msg: string) => void;
  connected: boolean;
}

export default function Chat({ messages, members, onSend, connected }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || !connected) return;
    onSend(msg);
    setInput("");
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="flex flex-col h-full bg-gray-900/80 border-l border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <h3 className="text-sm font-semibold text-white">Chat Room</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${connected ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
          {connected ? "Online" : "Offline"}
        </span>
      </div>

      {/* Members */}
      <div className="px-4 py-2 border-b border-white/10 shrink-0">
        <p className="text-xs text-gray-400 mb-1.5">Anggota ({members.length})</p>
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <div
              key={m.userId}
              title={m.isHost ? `${m.name} (Host)` : m.name}
              className="flex items-center gap-1 bg-gray-800 rounded-full px-2 py-0.5"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${m.isHost ? "bg-yellow-400" : "bg-green-400"}`} />
              <span className="text-xs text-gray-200 max-w-[80px] truncate">{m.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-gray-500 text-center mt-8">Belum ada pesan. Mulai chat!</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={msg.isSystem ? "text-center" : ""}>
            {msg.isSystem ? (
              <span className="text-xs text-gray-500 italic">{msg.message}</span>
            ) : (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-purple-400 truncate max-w-[100px]">
                    {msg.name}
                  </span>
                  <span className="text-[10px] text-gray-600 shrink-0">{formatTime(msg.timestamp)}</span>
                </div>
                <p className="text-sm text-gray-200 break-words mt-0.5">{msg.message}</p>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={submit} className="p-3 border-t border-white/10 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={connected ? "Ketik pesan..." : "Menghubungkan..."}
            disabled={!connected}
            maxLength={300}
            className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!connected || !input.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg px-3 py-2 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
