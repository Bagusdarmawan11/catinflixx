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
} from "lucide-react";
import type { VideoCallPeer } from "@/hooks/useVideoCall";

// ── VideoTile helper ─────────────────────────────────────────────────────────
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
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
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

// ── FloatingVideoCall — WhatsApp style ──────────────────────────────────────
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

  const [pos, setPos] = useState({ x: 16, y: 80 });
  const [panelW, setPanelW] = useState(260);
  const [mainH, setMainH] = useState(180);
  const [minimized, setMinimized] = useState(false);
  const [mainIsPeer, setMainIsPeer] = useState(true);

  const peerList = Array.from(peers.values());
  const activePeer = peerList[0] ?? null;

  const mainStream = mainIsPeer ? activePeer?.stream ?? null : localStream;
  const pipStream = mainIsPeer ? localStream : activePeer?.stream ?? null;
  const mainName = mainIsPeer ? (activePeer?.name ?? "Pasangan") : `${userName} (Kamu)`;
  const pipName = mainIsPeer ? `${userName} (Kamu)` : (activePeer?.name ?? "Pasangan");

  // Attach stream ke video element
  useEffect(() => {
    if (mainVideoRef.current && mainStream) {
      mainVideoRef.current.srcObject = mainStream;
    }
  }, [mainStream]);

  useEffect(() => {
    if (pipVideoRef.current && pipStream) {
      pipVideoRef.current.srcObject = pipStream;
    }
  }, [pipStream]);

  // ── Drag ──────────────────────────────────────────────────────────────────
  const dragRef = useRef<{
    startX: number; startY: number;
    startPX: number; startPY: number;
  } | null>(null);

  const onDragDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX, startY: e.clientY,
        startPX: pos.x, startPY: pos.y,
      };
    },
    [pos]
  );
  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const x = Math.max(0, Math.min(
      window.innerWidth - panelW,
      dragRef.current.startPX + e.clientX - dragRef.current.startX
    ));
    const y = Math.max(0, Math.min(
      window.innerHeight - 100,
      dragRef.current.startPY + e.clientY - dragRef.current.startY
    ));
    setPos({ x, y });
  }, [panelW]);
  const onDragUp = useCallback(() => { dragRef.current = null; }, []);

  // ── Resize ────────────────────────────────────────────────────────────────
  const resizeRef = useRef<{
    startX: number; startW: number; startH: number;
  } | null>(null);

  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      resizeRef.current = {
        startX: e.clientX, startW: panelW, startH: mainH,
      };
    },
    [panelW, mainH]
  );
  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const dx = e.clientX - resizeRef.current.startX;
    const newW = Math.max(180, Math.min(420, resizeRef.current.startW + dx));
    const newH = Math.round(newW * (9 / 16));
    setPanelW(newW);
    setMainH(newH);
  }, []);
  const onResizeUp = useCallback(() => { resizeRef.current = null; }, []);

  /*
   * FIX: z-index saat fullscreen.
   * VideoPlayer fullscreen pakai z-index:100.
   * FloatingVideoCall harus selalu di atas: z-index:200 (normal) atau z-index:210 saat fullscreen.
   * Badge minimize juga z-index:210 saat fullscreen supaya tetap visible.
   */
  const zIndex = isFullscreen ? 210 : 200;

  // Minimized: badge lebih besar agar mudah di-tap di mobile
  if (minimized) {
    return (
      <div
        ref={containerRef}
        style={{ position: "fixed", left: pos.x, top: pos.y, zIndex }}
        className="bg-gray-900 border border-white/20 rounded-2xl px-4 py-2.5 flex items-center gap-2.5 shadow-xl cursor-pointer select-none active:scale-95 transition-transform"
        onPointerDown={onDragDown}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onClick={() => setMinimized(false)}
      >
        <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shrink-0" />
        <span className="text-sm text-white whitespace-nowrap font-medium">📹 VC Aktif</span>
        <Maximize2 className="w-4 h-4 text-gray-400 shrink-0" />
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
        borderRadius: 16,
        overflow: "visible", // FIX: "hidden" menyebabkan resize handle terpotong
        boxShadow: "0 8px 40px rgba(0,0,0,0.85)",
        border: "1.5px solid rgba(255,255,255,0.15)",
        background: "#111827",
        userSelect: "none",
      }}
    >
      {/* Inner wrapper dengan overflow hidden untuk konten tapi tidak memotong resize */}
      <div style={{ borderRadius: 16, overflow: "hidden" }}>
        {/* Drag handle */}
        <div
          className="flex items-center justify-between px-3 py-1.5 bg-gray-900/90 cursor-grab active:cursor-grabbing"
          onPointerDown={onDragDown}
          onPointerMove={onDragMove}
          onPointerUp={onDragUp}
        >
          <span className="text-[11px] text-gray-400 select-none">
            📹 Video Call {peerList.length > 0 ? `· ${peerList.length + 1} orang` : ""}
          </span>
          {/* FIX: Tombol minimize lebih besar agar mudah di-tap */}
          <button
            onClick={(e) => { e.stopPropagation(); setMinimized(true); }}
            className="text-gray-400 hover:text-white p-1.5 transition-colors rounded-lg hover:bg-white/10"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Main video */}
        <div
          style={{ position: "relative", height: mainH, background: "#000" }}
        >
          {mainStream ? (
            <video
              ref={mainVideoRef}
              autoPlay
              playsInline
              muted={!mainIsPeer}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-800">
              <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center">
                <span className="text-white text-xl font-bold">
                  {mainName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-gray-400 text-xs">{mainName}</span>
              {!mainIsPeer && !camOn && (
                <span className="text-gray-500 text-[11px]">Kamera mati</span>
              )}
            </div>
          )}

          {/* Label main */}
          <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm rounded-md px-2 py-0.5">
            <span className="text-white text-[10px]">{mainName}</span>
          </div>

          {/* PiP */}
          <div
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              width: Math.round(panelW * 0.28),
              height: Math.round(panelW * 0.28 * (9 / 16)),
              borderRadius: 8,
              overflow: "hidden",
              border: "1.5px solid rgba(255,255,255,0.35)",
              background: "#1f2937",
              boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
            }}
          >
            {pipStream ? (
              <video
                ref={pipVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-700">
                <span className="text-white text-[11px] font-bold">
                  {pipName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 py-2 px-3 bg-gray-900/95">
          <button
            onClick={() => setMainIsPeer((v) => !v)}
            className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-2 transition-colors"
            title={mainIsPeer ? "Tampilkan videomu sebagai main" : "Tampilkan pasangan sebagai main"}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleCam}
            className={`rounded-full p-2 transition-colors text-white ${
              camOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-700"
            }`}
            title={camOn ? "Matikan kamera" : "Nyalakan kamera"}
          >
            {camOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onToggleMic}
            className={`rounded-full p-2 transition-colors text-white ${
              micOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-700"
            }`}
            title={micOn ? "Matikan mic" : "Nyalakan mic"}
          >
            {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onStop}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2 transition-colors"
            title="Akhiri video call"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Resize handle — di luar inner wrapper supaya tidak terpotong overflow:hidden */}
      <div
        style={{
          position: "absolute",
          bottom: -2,
          right: -2,
          width: 22,
          height: 22,
          cursor: "se-resize",
          zIndex: 1,
          background: "transparent",
        }}
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
      >
        <svg viewBox="0 0 10 10" className="w-full h-full text-gray-400">
          <path
            d="M9 1L1 9M9 5L5 9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

// ── Komponen utama VideoCall ─────────────────────────────────────────────────
interface VideoCallProps {
  callActive: boolean;
  localStream: MediaStream | null;
  peers: Map<string, VideoCallPeer>;
  camOn: boolean;
  micOn: boolean;
  userName: string;
  isFullscreen: boolean;
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

  // Saat fullscreen + call aktif → FloatingVideoCall WhatsApp style
  if (isFullscreen && callActive) {
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

  // Saat fullscreen tanpa call aktif → tampilkan tombol mulai call floating
  if (isFullscreen) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 210,
        }}
      >
        <button
          onClick={onStart}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl transition-colors"
        >
          <Video className="w-4 h-4" />
          Mulai VC
        </button>
      </div>
    );
  }

  // Normal: bar di atas chat
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

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleCam}
          className={`p-1.5 rounded-lg border transition-colors ${
            camOn
              ? "bg-gray-800 border-white/10 text-gray-300 hover:text-white"
              : "bg-red-600/30 border-red-500/40 text-red-400"
          }`}
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
        >
          {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
        </button>
        <span className="text-[10px] text-gray-500 flex-1">
          {peerList.length > 0 ? `${peerList.length + 1} orang di call` : "Hanya kamu di call"}
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
