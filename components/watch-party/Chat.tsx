"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Smile } from "lucide-react";
import type { ChatMessage, RoomMember } from "@/hooks/useWatchParty";

interface Props {
  messages: ChatMessage[];
  members: RoomMember[];
  onSend: (msg: string) => void;
  connected: boolean;
}

// Stiker emoji yang bisa dikirim
const STICKERS = [
  "❤️", "😍", "🥰", "😘", "💕", "💖",
  "😂", "🤣", "😭", "😩", "🥺", "🫶",
  "🔥", "✨", "🎉", "👏", "💯", "🙈",
  "😎", "🤩", "😋", "🤭", "😏", "🥳",
];

export default function Chat({ messages, members, onSend, connected }: Props) {
  const [input, setInput] = useState("");
  const [showStickers, setShowStickers] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  function onScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 60;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }

  useEffect(() => {
    if (!isAtBottomRef.current) return;
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || !connected) return;
    onSend(msg);
    setInput("");
    setShowStickers(false);
    isAtBottomRef.current = true;
    setTimeout(() => {
      const el = scrollContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  function sendSticker(sticker: string) {
    if (!connected) return;
    onSend(sticker);
    setShowStickers(false);
    isAtBottomRef.current = true;
    setTimeout(() => {
      const el = scrollContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Deteksi apakah pesan adalah stiker dari daftar STICKERS
  function isStickerMessage(msg: string): boolean {
    return STICKERS.includes(msg.trim());
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-900/80">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <h3 className="text-sm font-semibold text-white">Chat Room</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            connected
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {connected ? "Online" : "Offline"}
        </span>
      </div>

      {/* Members */}
      <div className="px-4 py-2 border-b border-white/10 shrink-0">
        <p className="text-xs text-gray-400 mb-1.5">
          Anggota ({members.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <span
              key={m.userId}
              className="flex items-center gap-1 text-xs bg-gray-800 text-gray-300 rounded-full px-2 py-0.5"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  m.isHost ? "bg-purple-400" : "bg-green-400"
                }`}
              />
              {m.name}
              {m.isHost && (
                <span className="text-[9px] text-purple-400 ml-0.5">HOST</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Messages — scroll hanya di dalam container ini */}
      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-1.5"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">
            Belum ada pesan. Mulai chat!
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${msg.isSystem ? "text-center" : ""}`}
          >
            {msg.isSystem ? (
              <span className="text-[11px] text-gray-500 italic">
                {msg.message}
              </span>
            ) : isStickerMessage(msg.message) ? (
              /* Render stiker besar */
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-purple-400 font-medium">
                  {msg.name}
                </span>
                <span className="text-3xl leading-tight">{msg.message}</span>
                <span className="text-[10px] text-gray-600">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11px] text-purple-400 font-medium shrink-0">
                    {msg.name}
                  </span>
                  <span className="text-xs text-white break-words min-w-0">
                    {msg.message}
                  </span>
                </div>
                <span className="text-[10px] text-gray-600">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sticker panel */}
      {showStickers && (
        <div className="px-3 py-2 border-t border-white/10 bg-gray-800/80 shrink-0">
          <div className="grid grid-cols-8 gap-1">
            {STICKERS.map((s) => (
              <button
                key={s}
                onClick={() => sendSticker(s)}
                className="text-xl hover:bg-white/10 rounded-lg p-1 transition-colors"
                title={s}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={submit}
        className="flex items-center gap-2 px-3 py-2 border-t border-white/10 bg-gray-900 shrink-0"
      >
        {/* Tombol stiker */}
        <button
          type="button"
          onClick={() => setShowStickers((v) => !v)}
          className={`shrink-0 transition-colors ${
            showStickers
              ? "text-purple-400"
              : "text-gray-500 hover:text-gray-300"
          }`}
          title="Stiker"
        >
          <Smile className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={connected ? "Tulis pesan..." : "Menghubungkan..."}
          disabled={!connected}
          className="flex-1 bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50 min-w-0"
        />
        <button
          type="submit"
          disabled={!connected || !input.trim()}
          className="shrink-0 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl p-2 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
