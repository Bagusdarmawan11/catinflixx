"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  PhoneCall,
  ArrowLeftRight,
  Minimize2,
  Maximize2,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { VideoCallPeer, VcParticipant } from "@/hooks/useVideoCall";

// ── FloatingVideoCall — hanya muncul saat fullscreen ────────────────────────
function FloatingVideoCall({
  localStream,
  peers,
  camOn,
  micOn,
  userName,
  isFullscreen,
  onToggleCam,
  onToggleMic,
  onStop,
}: {
  localStream: MediaStream | null;
  peers: Map<string, VideoCallPeer>;
  camOn: boolean;
  micOn: boolean;
  userName: string;
  isFullscreen: boolean;
  onToggleCam: () => void;
  onToggleMic: () => void;
  onStop: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);

  // FIX: posisi awal kiri atas, tidak terlalu mepet tepi
  const [pos, setPos] = useState({ x: 16, y: 72 });
  const [minimized, setMinimized] = useState(false);
  const [mainIsPeer, setMainIsPeer] = useState(true);

  // FIX: ukuran preset S/M/L — lebih mobile-friendly daripada drag resize
  const SIZES = [
    { label: "S", w: 180, h: 101 },
    { label: "M", w: 240, h: 135 },
    { label: "L", w: 300, h: 169 },
  ];
  const [sizeIdx, setSizeIdx] = useState(1); // default M
  const { w: panelW, h: mainH } = SIZES[sizeIdx];

  const peerList = Array.from(peers.values());
  const activePeer = peerList[0] ?? null;

  // FIX: nama asli dari data peer, bukan hard-coded "Pasangan"
  const peerName = activePeer?.name ?? "Menunggu...";
  const myName = userName;

  const mainStream = mainIsPeer ? activePeer?.stream ?? null : localStream;
  const pipStream = mainIsPeer ? localStream : activePeer?.stream ?? null;
  const mainName = mainIsPeer ? peerName : `${myName} (Kamu)`;
  const pipName = mainIsPeer ? `${myName} (Kamu)` : peerName;

  useEffect(() => {
    if (mainVideoRef.current && mainStream) {
      mainVideoRef.current.srcObject = mainStream;
      mainVideoRef.current.play().catch(() => {});
    }
  }, [mainStream]);

  useEffect(() => {
    if (pipVideoRef.current && pipStream) {
      pipVideoRef.current.srcObject = pipStream;
      pipVideoRef.current.play().catch(() => {});
    }
  }, [pipStream]);

  // ── Drag (touch & mouse) ─────────────────────────────────────────────────
  const dragRef = useRef<{
    startX: number; startY: number;
    startPX: number; startPY: number;
    moved: boolean;
  } | null>(null);

  const onDragDown = useCallback(
    (e: React.PointerEvent) => {
      // Jangan drag kalau klik tombol
      if ((e.target as HTMLElement).closest("button")) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX, startY: e.clientY,
        startPX: pos.x, startPY: pos.y,
        moved: false,
      };
    },
    [pos]
  );

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
    const x = Math.max(0, Math.min(window.innerWidth - panelW, dragRef.current.startPX + dx));
    const y = Math.max(0, Math.min(window.innerHeight - 80, dragRef.current.startPY + dy));
    setPos({ x, y });
  }, [panelW]);

  const onDragUp = useCallback(() => { dragRef.current = null; }, []);

  // z-index: di atas video (z100) dan kontrol YouTube
  const zIndex = isFullscreen ? 210 : 200;

  // ── Minimized badge ──────────────────────────────────────────────────────
  if (minimized) {
    return (
      <div
        style={{ position: "fixed", left: pos.x, top: pos.y, zIndex, touchAction: "none" }}
        className="bg-gray-900 border border-white/20 rounded-2xl px-3 py-2 flex items-center gap-2 shadow-xl select-none"
        onPointerDown={onDragDown}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onClick={() => setMinimized(false)}
      >
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
        <span className="text-sm text-white font-medium">📹 VC</span>
        <Maximize2 className="w-3.5 h-3.5 text-gray-400" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: panelW,
        zIndex,
        borderRadius: 14,
        boxShadow: "0 8px 32px rgba(0,0,0,0.9)",
        border: "1.5px solid rgba(255,255,255,0.12)",
        background: "#111827",
        userSelect: "none",
        touchAction: "none",
        overflow: "hidden",
      }}
    >
      {/* ── Header / Drag handle ── */}
      <div
        className="flex items-center justify-between px-2.5 py-1.5 bg-gray-900 cursor-grab active:cursor-grabbing"
        onPointerDown={onDragDown}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        style={{ touchAction: "none" }}
      >
        <span className="text-[11px] text-gray-400 select-none">
          📹 {peerList.length > 0 ? `${peerList.length + 1} orang` : "VC Aktif"}
        </span>
        <div className="flex items-center gap-0.5">
          {/* FIX: Tombol ukuran preset S/M/L — ramah mobile */}
          {SIZES.map((s, i) => (
            <button
              key={s.label}
              onClick={(e) => { e.stopPropagation(); setSizeIdx(i); }}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                sizeIdx === i
                  ? "bg-purple-600 text-white"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
          {/* FIX: Tombol minimize — hanya menyembunyikan ke badge kecil */}
          <button
            onClick={(e) => { e.stopPropagation(); setMinimized(true); }}
            className="ml-1 text-gray-400 hover:text-white p-1 rounded transition-colors"
            title="Sembunyikan"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main video ── */}
      <div style={{ position: "relative", height: mainH, background: "#000" }}>
        {mainStream ? (
          <video
            ref={mainVideoRef}
            autoPlay
            playsInline
            muted={!mainIsPeer}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gray-800">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
              <span className="text-white text-lg font-bold">
                {mainName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-gray-400 text-[11px]">{mainName}</span>
          </div>
        )}

        {/* Label nama */}
        <div className="absolute bottom-1 left-1 bg-black/50 rounded px-1.5 py-0.5">
          <span className="text-white text-[10px]">{mainName}</span>
        </div>

        {/* PiP pojok kanan bawah */}
        {(localStream || activePeer) && (
          <div
            style={{
              position: "absolute",
              bottom: 6, right: 6,
              width: Math.round(panelW * 0.3),
              height: Math.round(panelW * 0.3 * (9 / 16)),
              borderRadius: 6, overflow: "hidden",
              border: "1.5px solid rgba(255,255,255,0.3)",
              background: "#1f2937",
            }}
          >
            {pipStream ? (
              <video
                ref={pipVideoRef}
                autoPlay playsInline muted
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-700">
                <span className="text-white text-[10px] font-bold">
                  {pipName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="absolute bottom-0.5 left-0.5 bg-black/50 rounded px-1">
              <span className="text-white text-[9px]">{pipName}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center justify-center gap-2 py-1.5 px-2 bg-gray-900">
        <button
          onClick={() => setMainIsPeer((v) => !v)}
          className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-1.5"
          title="Tukar tampilan"
        >
          <ArrowLeftRight className="w-3 h-3" />
        </button>
        <button
          onClick={onToggleCam}
          className={`rounded-full p-1.5 text-white ${camOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600"}`}
        >
          {camOn ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
        </button>
        <button
          onClick={onToggleMic}
          className={`rounded-full p-1.5 text-white ${micOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600"}`}
        >
          {micOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
        </button>
        <button
          onClick={onStop}
          className="bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5"
          title="Akhiri VC"
        >
          <PhoneOff className="w-3 h-3" />
        </button>
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
  isFullscreen: boolean;
  // FIX: mode "sidebar" = bar VC di dalam kolom chat (di atas daftar chat).
  //      mode "floating" = jendela VC melayang, hanya saat fullscreen.
  // Page merender dua instance: satu di dalam kolom chat, satu di luar.
  mode?: "sidebar" | "floating";
  vcParticipants: VcParticipant[];
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
  mode = "sidebar",
  vcParticipants,
  onStart,
  onStop,
  onToggleCam,
  onToggleMic,
}: VideoCallProps) {

  // ── Mode floating: hanya render saat fullscreen ───────────────────────────
  if (mode === "floating") {
    if (!isFullscreen) return null;

    if (callActive) {
      return (
        <FloatingVideoCall
          localStream={localStream}
          peers={peers}
          camOn={camOn}
          micOn={micOn}
          userName={userName}
          isFullscreen={isFullscreen}
          onToggleCam={onToggleCam}
          onToggleMic={onToggleMic}
          onStop={onStop}
        />
      );
    }

    // Fullscreen tapi call belum aktif → tombol mulai (di atas tombol keluar fullscreen)
    return (
      <div style={{ position: "fixed", bottom: 56, right: 12, zIndex: 210 }}>
        <button
          onClick={onStart}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl transition-colors"
        >
          <Video className="w-4 h-4" />
          {vcParticipants.length > 0 ? `Gabung VC (${vcParticipants.length})` : "Mulai VC"}
        </button>
      </div>
    );
  }

  // ── Mode sidebar: saat fullscreen, FloatingVC yang tampil ─────────────────
  if (isFullscreen) return null;

  // ── Di luar fullscreen: tampilkan sebagai bar di sidebar ──────────────────
  const peerEntries = Array.from(peers.entries());
  const peerList = peerEntries.map(([, p]) => p);

  if (!callActive) {
    // Bar saat belum ada call
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/60 border-b border-white/10 shrink-0">
        <PhoneCall className="w-4 h-4 text-purple-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs text-gray-400">Video call tersedia</span>
          {vcParticipants.length > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <Users className="w-3 h-3 text-green-400 shrink-0" />
              <span className="text-[10px] text-green-400 truncate">
                {vcParticipants.map((p) => p.userName).join(", ")} sedang di VC
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onStart}
          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          <Video className="w-3.5 h-3.5" />
          {vcParticipants.length > 0 ? "Gabung" : "Mulai"}
        </button>
      </div>
    );
  }

  // Bar saat call aktif di sidebar (tanpa floating)
  return (
    <div className="bg-gray-900/80 border-b border-white/10 px-3 py-2 space-y-2 shrink-0">
      {/* Video tiles */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* Tile kamu sendiri */}
        <LocalTile stream={localStream} name={`${userName} (Kamu)`} />
        {/* Tile peers — FIX: pakai nama asli dari peer.name */}
        {peerEntries.map(([socketId, peer]) => (
          <PeerTile key={socketId} stream={peer.stream} name={peer.name} />
        ))}
        {peerList.length === 0 && (
          <div className="flex-shrink-0 w-28 sm:w-32 aspect-video bg-gray-800/60 rounded-lg border border-dashed border-white/20 flex items-center justify-center">
            <p className="text-[10px] text-gray-500 text-center px-1">
              Tunggu teman join...
            </p>
          </div>
        )}
      </div>
      {/* Kontrol */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleCam}
          className={`p-1.5 rounded-lg border transition-colors ${
            camOn ? "bg-gray-800 border-white/10 text-gray-300" : "bg-red-600/30 border-red-500/40 text-red-400"
          }`}
        >
          {camOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onToggleMic}
          className={`p-1.5 rounded-lg border transition-colors ${
            micOn ? "bg-gray-800 border-white/10 text-gray-300" : "bg-red-600/30 border-red-500/40 text-red-400"
          }`}
        >
          {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
        </button>
        <span className="text-[10px] text-gray-500 flex-1">
          {peerList.length > 0 ? `${peerList.length + 1} orang di call` : "Hanya kamu"}
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

// ── Tile helpers ──────────────────────────────────────────────────────────────
function LocalTile({ stream, name }: { stream: MediaStream | null; name: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && stream) { ref.current.srcObject = stream; ref.current.play().catch(() => {}); } }, [stream]);
  return (
    <div className="flex-shrink-0 w-28 sm:w-32 aspect-video bg-gray-800 rounded-lg overflow-hidden border border-white/10 relative">
      {stream
        ? <video ref={ref} autoPlay playsInline muted className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-white text-sm font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
          </div>
      }
      <span className="absolute bottom-1 left-1 text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded truncate max-w-[calc(100%-8px)]">{name}</span>
    </div>
  );
}

function PeerTile({ stream, name }: { stream: MediaStream | null; name: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && stream) { ref.current.srcObject = stream; ref.current.play().catch(() => {}); } }, [stream]);
  return (
    <div className="flex-shrink-0 w-28 sm:w-32 aspect-video bg-gray-800 rounded-lg overflow-hidden border border-white/10 relative">
      {stream
        ? <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-sm font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
          </div>
      }
      <span className="absolute bottom-1 left-1 text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded truncate max-w-[calc(100%-8px)]">{name}</span>
    </div>
  );
}
