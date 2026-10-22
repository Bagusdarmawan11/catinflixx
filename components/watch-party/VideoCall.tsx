"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  PhoneCall,
  Maximize2,
  Minimize2,
} from "lucide-react";
import type { VideoCallPeer } from "@/hooks/useVideoCall";

// ── Helper: lock ke landscape di mobile ──────────────────────────────────────
async function lockLandscape() {
  try {
    const screen = window.screen as any;
    if (screen.orientation?.lock) {
      await screen.orientation.lock("landscape");
    }
  } catch {
    // Browser tidak support, tidak apa-apa
  }
}

async function unlockOrientation() {
  try {
    const screen = window.screen as any;
    if (screen.orientation?.unlock) {
      screen.orientation.unlock();
    }
  } catch {}
}

// ── VideoTile ─────────────────────────────────────────────────────────────────
function VideoTile({
  stream,
  name,
  muted = false,
  className = "",
}: {
  stream: MediaStream | null;
  name: string;
  muted?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className={`relative bg-gray-800 rounded-lg overflow-hidden border border-white/10 ${className}`}
    >
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-white text-sm font-bold">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <span className="absolute bottom-1 left-1 text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded truncate max-w-[calc(100%-8px)]">
        {name}
      </span>
    </div>
  );
}

// ── Floating PiP (saat fullscreen) ───────────────────────────────────────────
function FloatingVideoCall({
  localStream,
  peers,
  camOn,
  micOn,
  userName,
  onToggleCam,
  onToggleMic,
  onStop,
}: {
  localStream: MediaStream | null;
  peers: Map<string, VideoCallPeer>;
  camOn: boolean;
  micOn: boolean;
  userName: string;
  onToggleCam: () => void;
  onToggleMic: () => void;
  onStop: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const [size, setSize] = useState({ w: 160, h: 120 });
  const [expanded, setExpanded] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startW: number; startH: number } | null>(null);

  // Drag handler
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
    };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: Math.max(0, dragRef.current.startPosX + dx),
      y: Math.max(0, dragRef.current.startPosY + dy),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Resize handler
  const onResizeDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = {
      startX: e.clientX,
      startW: size.w,
      startH: size.h,
    };
  }, [size]);

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const dx = e.clientX - resizeRef.current.startX;
    const newW = Math.max(120, Math.min(400, resizeRef.current.startW + dx));
    const newH = Math.round(newW * 0.75);
    setSize({ w: newW, h: newH });
  }, []);

  const onResizeUp = useCallback(() => {
    resizeRef.current = null;
  }, []);

  const peerList = Array.from(peers.values());
  const currentW = expanded ? Math.max(size.w, 280) : size.w;
  const currentH = expanded ? Math.round(currentW * 0.75) : size.h;

  return (
    <div
      ref={containerRef}
      className="fixed z-[200] rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-gray-900 select-none"
      style={{ left: pos.x, top: pos.y, width: currentW, height: "auto" }}
    >
      {/* Drag handle */}
      <div
        className="cursor-grab active:cursor-grabbing bg-gray-800/80 px-2 py-1 flex items-center gap-1.5"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="text-[10px] text-gray-400 flex-1 truncate">
          📹 {peerList.length > 0 ? `${peerList.length + 1} di call` : "Video Call"}
        </span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-gray-400 hover:text-white p-0.5"
        >
          {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </button>
      </div>

      {/* Video tiles */}
      <div
        className="grid gap-1 p-1 bg-gray-900"
        style={{
          gridTemplateColumns: peerList.length > 0 ? "1fr 1fr" : "1fr",
        }}
      >
        <VideoTile
          stream={localStream}
          name={`${userName}`}
          muted
          className="aspect-video"
        />
        {peerList.map((p) => (
          <VideoTile
            key={p.userId}
            stream={p.stream}
            name={p.name}
            className="aspect-video"
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-900/90">
        <button
          onClick={onToggleCam}
          className={`p-1.5 rounded-lg border text-xs transition-colors ${
            camOn
              ? "bg-gray-800 border-white/10 text-gray-300"
              : "bg-red-600/30 border-red-500/40 text-red-400"
          }`}
        >
          {camOn ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
        </button>
        <button
          onClick={onToggleMic}
          className={`p-1.5 rounded-lg border text-xs transition-colors ${
            micOn
              ? "bg-gray-800 border-white/10 text-gray-300"
              : "bg-red-600/30 border-red-500/40 text-red-400"
          }`}
        >
          {micOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
        </button>
        <button
          onClick={onStop}
          className="ml-auto flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-medium px-2 py-1 rounded-lg transition-colors"
        >
          <PhoneOff className="w-3 h-3" />
          Keluar
        </button>
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
      >
        <svg viewBox="0 0 10 10" className="w-full h-full text-gray-600">
          <path d="M9 1L1 9M9 5L5 9M9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

// ── Komponen utama VideoCall ──────────────────────────────────────────────────
interface VideoCallProps {
  callActive: boolean;
  localStream: MediaStream | null;
  peers: Map<string, VideoCallPeer>;
  camOn: boolean;
  micOn: boolean;
  userName: string;
  isFullscreen: boolean; // dari parent, apakah video player sedang fullscreen
  onStart: () => void;
  onStop: () => void;
  onToggleCam: () => void;
  onToggleMic: () => void;
}

export default function VideoCall({
  callActive,
  localStream,
  peers,
  camOn,
  micOn,
  userName,
  isFullscreen,
  onStart,
  onStop,
  onToggleCam,
  onToggleMic,
}: VideoCallProps) {
  const peerList = Array.from(peers.values());

  // Saat fullscreen aktif → lock landscape
  useEffect(() => {
    if (isFullscreen) {
      lockLandscape();
    } else {
      unlockOrientation();
    }
  }, [isFullscreen]);

  // Saat fullscreen dan call aktif → render floating PiP
  if (isFullscreen && callActive) {
    return (
      <FloatingVideoCall
        localStream={localStream}
        peers={peers}
        camOn={camOn}
        micOn={micOn}
        userName={userName}
        onToggleCam={onToggleCam}
        onToggleMic={onToggleMic}
        onStop={onStop}
      />
    );
  }

  // Saat fullscreen tanpa call → tidak tampil apa-apa (bersih)
  if (isFullscreen) return null;

  // Normal (non-fullscreen): bar di atas chat
  if (!callActive) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/60 border-b border-white/10 shrink-0">
        <PhoneCall className="w-4 h-4 text-purple-400 shrink-0" />
        <span className="text-xs text-gray-400 flex-1">Video call tersedia</span>
        <button
          onClick={onStart}
          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Video className="w-3.5 h-3.5" />
          Mulai
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/80 border-b border-white/10 px-3 py-2 space-y-2 shrink-0">
      {/* Baris tiles video */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <VideoTile
          stream={localStream}
          name={`${userName} (Kamu)`}
          muted
          className="flex-shrink-0 w-28 sm:w-32 aspect-video"
        />
        {peerList.map((peer) => (
          <VideoTile
            key={peer.userId}
            stream={peer.stream}
            name={peer.name}
            className="flex-shrink-0 w-28 sm:w-32 aspect-video"
          />
        ))}
        {peerList.length === 0 && (
          <div className="flex-shrink-0 w-28 sm:w-32 aspect-video bg-gray-800/60 rounded-lg border border-dashed border-white/20 flex items-center justify-center">
            <p className="text-[10px] text-gray-500 text-center px-1">
              Tunggu pasangan join…
            </p>
          </div>
        )}
      </div>

      {/* Kontrol */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleCam}
          className={`p-1.5 rounded-lg border transition-colors ${
            camOn
              ? "bg-gray-800 border-white/10 text-gray-300 hover:text-white"
              : "bg-red-600/30 border-red-500/40 text-red-400"
          }`}
          title={camOn ? "Matikan kamera" : "Nyalakan kamera"}
        >
          {camOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onToggleMic}
          className={`p-1.5 rounded-lg border transition-colors ${
            micOn
              ? "bg-gray-800 border-white/10 text-gray-300 hover:text-white"
              : "bg-red-600/30 border-red-500/40 text-red-400"
          }`}
          title={micOn ? "Matikan mic" : "Nyalakan mic"}
        >
          {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
        </button>
        <span className="text-[10px] text-gray-500 flex-1">
          {peerList.length > 0
            ? `${peerList.length + 1} orang di call`
            : "Hanya kamu di call"}
        </span>
        <button
          onClick={onStop}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          Keluar
        </button>
      </div>
    </div>
  );
}
